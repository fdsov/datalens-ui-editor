import type {AppConfig, AppContext} from '@gravity-ui/nodekit';

import {CacheClient} from '../../../cache-client';

import {RequestAxios, parseCacheDuration} from './axios';

describe('charts-engine RequestAxios caching', () => {
    describe('parseCacheDuration', () => {
        test.each([
            [300, 300],
            ['300', 300],
            ['45s', 45],
            ['5m', 300],
            ['2h', 7200],
            ['1d', 86400],
            ['0', 0],
            ['', null],
            [null, null],
            [undefined, null],
            ['invalid', null],
        ])('parses %p -> %p', (input, expected) => {
            expect(parseCacheDuration(input)).toBe(expected);
        });
    });

    describe('cacheRequest', () => {
        const makeCtx = () =>
            ({
                log: jest.fn(),
                logError: jest.fn(),
            }) as unknown as AppContext;

        const createMemoryCache = () => {
            const store = new Map<string, {value: unknown; ttl?: number}>();
            const cache = {
                get: jest.fn(async ({key}: {key: string}) => {
                    if (!store.has(key)) {
                        return {status: CacheClient.KEY_NOT_FOUND};
                    }
                    return {status: CacheClient.OK, data: store.get(key)?.value};
                }),
                set: jest.fn(
                    async ({key, value, ttl}: {key: string; value: unknown; ttl?: number}) => {
                        store.set(key, {value, ttl});
                        return {status: CacheClient.OK};
                    },
                ),
                del: jest.fn(async ({key}: {key: string}) => {
                    store.delete(key);
                    return {status: CacheClient.OK};
                }),
            } as unknown as CacheClient;
            return {cache, store};
        };

        afterEach(() => {
            jest.restoreAllMocks();
        });

        test('caches DashSQL NDJSON string responses and returns full response envelope on hit', async () => {
            const {cache, store} = createMemoryCache();
            RequestAxios.init({
                cacheClientInstance: cache,
                config: {} as AppConfig,
            });

            const ndjsonBody =
                '{"event":"metadata","data":{"names":["a"]}}\n{"event":"row","data":[1]}\n';
            const directSpy = jest.spyOn(RequestAxios, 'directRequest').mockResolvedValue({
                statusCode: 200,
                body: ndjsonBody,
                headers: {'content-type': 'application/x-ndjson'},
            });

            const controller = new AbortController();
            const requestOptions = {
                method: 'POST',
                uri: 'http://data-api:8080/api/data/v1/connections/9qpuryly00vit/dashsql',
                body: {sql_query: 'SELECT 1'},
                signal: controller.signal,
                ctx: makeCtx(),
                spCacheDuration: '5m',
                cacheKeyPrefix: 'common:wb-1',
                useCaching: true,
            };

            const first = await RequestAxios.request({
                requestOptions,
                useCaching: true,
                requestControl: {allBuffersLength: 0},
            });
            expect(first).toEqual({
                statusCode: 200,
                body: ndjsonBody,
                headers: {'content-type': 'application/x-ndjson'},
            });
            expect(directSpy).toHaveBeenCalledTimes(1);
            expect(store.size).toBe(1);
            const [storedEntry] = Array.from(store.values());
            expect(storedEntry.ttl).toBe(300);

            const second = await RequestAxios.request({
                requestOptions,
                useCaching: true,
                requestControl: {allBuffersLength: 0},
            });
            expect(directSpy).toHaveBeenCalledTimes(1);
            expect(second).toEqual({
                statusCode: 200,
                body: ndjsonBody,
                headers: {
                    'content-type': 'application/x-ndjson',
                    'x-charts-from-cache': '1',
                },
            });
        });

        test('separates cache keys by request body and cacheKeyPrefix and does not cache non-2xx', async () => {
            const {cache, store} = createMemoryCache();
            RequestAxios.init({
                cacheClientInstance: cache,
                config: {} as AppConfig,
            });

            const directSpy = jest
                .spyOn(RequestAxios, 'directRequest')
                .mockResolvedValueOnce({
                    statusCode: 200,
                    body: {rows: [1]},
                    headers: {},
                })
                .mockResolvedValueOnce({
                    statusCode: 200,
                    body: {rows: [2]},
                    headers: {},
                })
                .mockResolvedValueOnce({
                    statusCode: 500,
                    body: {error: 'boom'},
                    headers: {},
                });

            const signal = new AbortController().signal;
            const uri = 'http://data-api:8080/api/data/v1/connections/conn1/dashsql';

            const res1 = await RequestAxios.request({
                requestOptions: {
                    method: 'POST',
                    uri,
                    body: {sql_query: 'SELECT 1'},
                    signal,
                    ctx: makeCtx(),
                    spCacheDuration: 120,
                    cacheKeyPrefix: 'common:wb-1',
                    useCaching: true,
                },
                useCaching: true,
                requestControl: {allBuffersLength: 0},
            });
            const res2 = await RequestAxios.request({
                requestOptions: {
                    method: 'POST',
                    uri,
                    body: {sql_query: 'SELECT 2'},
                    signal,
                    ctx: makeCtx(),
                    spCacheDuration: 120,
                    cacheKeyPrefix: 'common:wb-1',
                    useCaching: true,
                },
                useCaching: true,
                requestControl: {allBuffersLength: 0},
            });
            const resErr = await RequestAxios.request({
                requestOptions: {
                    method: 'POST',
                    uri,
                    body: {sql_query: 'SELECT broken'},
                    signal,
                    ctx: makeCtx(),
                    spCacheDuration: 120,
                    cacheKeyPrefix: 'common:wb-2',
                    useCaching: true,
                },
                useCaching: true,
                requestControl: {allBuffersLength: 0},
            });

            expect(res1.body).toEqual({rows: [1]});
            expect(res2.body).toEqual({rows: [2]});
            expect(resErr.statusCode).toBe(500);
            expect(directSpy).toHaveBeenCalledTimes(3);
            expect(store.size).toBe(2);
        });

        test('forceRefresh bypasses cached read and repopulates cache with fresh response', async () => {
            const {cache, store} = createMemoryCache();
            RequestAxios.init({
                cacheClientInstance: cache,
                config: {} as AppConfig,
            });

            const directSpy = jest
                .spyOn(RequestAxios, 'directRequest')
                .mockResolvedValueOnce({
                    statusCode: 200,
                    body: 'old-ndjson',
                    headers: {},
                })
                .mockResolvedValueOnce({
                    statusCode: 200,
                    body: 'fresh-ndjson',
                    headers: {},
                });

            const signal = new AbortController().signal;
            const baseOpts = {
                method: 'POST',
                uri: 'http://data-api:8080/api/data/v1/connections/conn1/dashsql',
                body: {sql_query: 'SELECT now()'},
                signal,
                ctx: makeCtx(),
                spCacheDuration: 3600,
                cacheKeyPrefix: 'common:wb-1',
                useCaching: true,
            };

            const first = await RequestAxios.request({
                requestOptions: baseOpts,
                useCaching: true,
                requestControl: {allBuffersLength: 0},
            });
            expect(first.body).toBe('old-ndjson');

            const refreshed = await RequestAxios.request({
                requestOptions: {...baseOpts, forceRefresh: true},
                useCaching: true,
                requestControl: {allBuffersLength: 0},
            });
            expect(refreshed.body).toBe('fresh-ndjson');
            expect(directSpy).toHaveBeenCalledTimes(2);
            expect(store.size).toBe(1);

            const afterRefresh = await RequestAxios.request({
                requestOptions: baseOpts,
                useCaching: true,
                requestControl: {allBuffersLength: 0},
            });
            expect(afterRefresh.body).toBe('fresh-ndjson');
            expect(afterRefresh.headers['x-charts-from-cache']).toBe('1');
            expect(directSpy).toHaveBeenCalledTimes(2);
        });
    });
});
