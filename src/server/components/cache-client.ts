import type {AppConfig} from '@gravity-ui/nodekit';
import Redis from 'ioredis';

export type CacheStatus =
    | typeof CacheClient.OK
    | typeof CacheClient.KEY_NOT_FOUND
    | typeof CacheClient.NOT_OK;
export type CacheClientResponse = {
    message?: string;
    status: CacheStatus;
    data?: any;
};

export type InvalidateCacheOptions = {
    workbookId?: string;
    datasetIds?: string[];
    connectionIds?: string[];
    flushAll?: boolean;
};

export type InvalidateCacheResult = {
    deletedUiKeys: number;
    deletedDataApiKeys: number;
};

const REDIS_TIMEOUT = 2000;
const REDIS_SCAN_TIMEOUT = 5000;
const MAX_SCAN_ITERATIONS = 500;

const sanitizePatternSegment = (value: string) => value.replace(/[^a-zA-Z0-9_.:/-]/g, '');

async function scanAndUnlink(redisClient: Redis.Redis, pattern: string): Promise<number> {
    let cursor = '0';
    let deleted = 0;
    let iterations = 0;

    do {
        const [nextCursor, keys] = await timeout(
            redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 200),
            REDIS_SCAN_TIMEOUT,
        );
        cursor = nextCursor;
        iterations += 1;

        if (keys.length > 0) {
            await timeout(redisClient.unlink(...keys), REDIS_SCAN_TIMEOUT);
            deleted += keys.length;
        }
    } while (cursor !== '0' && iterations < MAX_SCAN_ITERATIONS);

    return deleted;
}

const timeout = <T>(prom: Promise<T>, time: number): Promise<T> => {
    let timer: NodeJS.Timeout;
    return Promise.race<T>([
        prom,
        new Promise((_r, rej) => {
            timer = setTimeout(rej, time, Error('TimeoutError'));
        }),
    ]).finally(() => clearTimeout(timer));
};

export class CacheClient {
    static OK = Symbol('CACHE_STATUS_OK');
    static NOT_OK = Symbol('CACHE_STATUS_NOT_OK');
    static KEY_NOT_FOUND = Symbol('CACHE_STATUS_KEY_NOT_FOUND');

    _debug = false;
    client: Redis.Redis | null = null;
    dataApiClient: Redis.Redis | null = null;

    constructor({config}: {config: AppConfig}) {
        this._debug = config.appInstallation === 'development';

        if (
            config.redis &&
            (('host' in config.redis && config.redis.host) ||
                ('sentinels' in config.redis && config.redis.sentinels?.length) ||
                config.redis.password)
        ) {
            this.client = new Redis(config.redis);
            this.client.on('error', () => {
                // Handled gracefully per-request via CacheClient.NOT_OK fallback
            });

            const dataApiDb = Number(process.env.DATA_API_REDIS_DB || 0);
            this.dataApiClient = new Redis({
                ...config.redis,
                db: dataApiDb,
            });
            this.dataApiClient.on('error', () => {
                // Handled gracefully per-request
            });
        }
    }

    async get({key}: {key: string}): Promise<CacheClientResponse> {
        if (this.client) {
            try {
                const data = await timeout(this.client.get(key), REDIS_TIMEOUT);
                if (data === null) {
                    return {
                        status: CacheClient.KEY_NOT_FOUND,
                    };
                }
                return {
                    status: CacheClient.OK,
                    data: JSON.parse(data),
                };
            } catch (error: any) {
                return {
                    status: CacheClient.NOT_OK,
                    message: error.message || 'Service unavailable',
                };
            }
        } else {
            return {
                status: CacheClient.NOT_OK,
                message: 'Redis client is null',
            };
        }
    }

    async set({
        key,
        value,
        ttl,
    }: {
        key: string;
        value: any;
        ttl?: number;
    }): Promise<CacheClientResponse> {
        if (this.client) {
            try {
                await timeout(
                    this.client.set(key, JSON.stringify(value), 'EX', ttl),
                    REDIS_TIMEOUT,
                );
                return {
                    status: CacheClient.OK,
                };
            } catch (error: any) {
                return {
                    status: CacheClient.NOT_OK,
                    message: error.message || 'Service unavailable',
                };
            }
        } else {
            return {
                status: CacheClient.NOT_OK,
                message: 'Redis client is null',
            };
        }
    }

    async del({key}: {key: string}): Promise<CacheClientResponse> {
        if (this.client) {
            try {
                await timeout(this.client.del(key), REDIS_TIMEOUT);
                return {
                    status: CacheClient.OK,
                };
            } catch (error: any) {
                return {
                    status: CacheClient.NOT_OK,
                    message: error.message || 'Service unavailable',
                };
            }
        } else {
            return {
                status: CacheClient.NOT_OK,
                message: 'Redis client is null',
            };
        }
    }

    async invalidateCache(options: InvalidateCacheOptions = {}): Promise<InvalidateCacheResult> {
        const {workbookId, datasetIds, connectionIds, flushAll} = options;
        let deletedUiKeys = 0;
        let deletedDataApiKeys = 0;

        if (this.client) {
            try {
                const uiPatterns: string[] = [];
                if (workbookId) {
                    const safeWb = sanitizePatternSegment(workbookId);
                    if (safeWb) {
                        uiPatterns.push(`sp:*:${safeWb}:*`);
                    }
                }
                if (Array.isArray(connectionIds) && connectionIds.length > 0) {
                    connectionIds.forEach((id) => {
                        const safeId = sanitizePatternSegment(id);
                        if (safeId) {
                            uiPatterns.push(`sp:*connections/${safeId}/dashsql*`);
                        }
                    });
                }
                if (flushAll || uiPatterns.length === 0) {
                    if (!Array.isArray(datasetIds) || datasetIds.length === 0 || flushAll) {
                        uiPatterns.push('sp:*');
                    }
                }

                for (const pattern of uiPatterns) {
                    deletedUiKeys += await scanAndUnlink(this.client, pattern);
                }
            } catch {
                // Ignore Redis invalidation failures to keep request path resilient
            }
        }

        if (this.dataApiClient) {
            try {
                const dataApiPatterns: string[] = [];
                if (Array.isArray(datasetIds) && datasetIds.length > 0) {
                    datasetIds.forEach((id) => {
                        const safeId = sanitizePatternSegment(id);
                        if (safeId) {
                            dataApiPatterns.push(`bic_dp_ce_l__*${safeId}__*`);
                        }
                    });
                } else if (flushAll || workbookId || !connectionIds || connectionIds.length === 0) {
                    dataApiPatterns.push('bic_dp_ce_l__*__query_cache//*');
                }

                for (const pattern of dataApiPatterns) {
                    deletedDataApiKeys += await scanAndUnlink(this.dataApiClient, pattern);
                }
            } catch {
                // Ignore Redis invalidation failures to keep request path resilient
            }
        }

        return {deletedUiKeys, deletedDataApiKeys};
    }
}

export default CacheClient;
