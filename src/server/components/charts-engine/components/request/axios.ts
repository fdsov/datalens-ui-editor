import type {IncomingHttpHeaders, IncomingMessage, OutgoingHttpHeaders} from 'http';
import querystring from 'node:querystring';

import type {AppConfig, AppContext} from '@gravity-ui/nodekit';
import {crc32c} from '@node-rs/crc32';
import type {AxiosInstance, AxiosRequestConfig, RawAxiosRequestHeaders} from 'axios';
import axios from 'axios';

import {getAxios} from '../../../axios';
import {CacheClient} from '../../../cache-client';
import {config} from '../../constants';
import {hideSensitiveData} from '../utils';

type RequestOptions = Omit<AxiosRequestConfig, 'headers'> & {
    useCaching?: boolean;
    signal: AbortSignal;
    uri?: string;
    form?: unknown;
    json?: boolean;
    qs?: Record<string, unknown>;
    body?: unknown;
    headers?: OutgoingHttpHeaders | RawAxiosRequestHeaders;
};

type CachedRequestOptions = RequestOptions & {
    uri: string;
    ctx: AppContext;
    spCacheDuration: string | number | null;
    cacheKeyPrefix?: string;
};

type CachedResponseEnvelope = {
    statusCode: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: any;
    headers: IncomingHttpHeaders;
};

const DURATION_UNITS_SECONDS: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
};

export function parseCacheDuration(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? Math.floor(value) : null;
    }
    const trimmed = String(value).trim().toLowerCase();
    const lastChar = trimmed[trimmed.length - 1];
    const unit =
        lastChar && DURATION_UNITS_SECONDS[lastChar] ? DURATION_UNITS_SECONDS[lastChar] : 1;
    const numericPart =
        lastChar && DURATION_UNITS_SECONDS[lastChar] ? trimmed.slice(0, -1) : trimmed;
    if (!numericPart) {
        return null;
    }
    const amount = Number(numericPart);
    return Number.isFinite(amount) ? Math.floor(amount * unit) : null;
}

interface RequestInstanceLike {
    abort: () => void;
    emit: (event: string, error: Error) => void;
    _started?: boolean;
}

const isCachedRequestOptions = (
    options: RequestOptions | CachedRequestOptions,
): options is CachedRequestOptions =>
    'useCaching' in options && Boolean(options.useCaching) && 'ctx' in options;

const {
    REQUEST_SIZE_LIMIT,
    ALL_REQUESTS_SIZE_LIMIT,
    REQUEST_SIZE_LIMIT_EXCEEDED,
    ALL_REQUESTS_SIZE_LIMIT_EXCEEDED,
} = config;

const CACHE_PREFIX = 'sp';

let cacheClient: CacheClient;

function normalizeHeaders(
    headers: OutgoingHttpHeaders | RawAxiosRequestHeaders | undefined,
): RawAxiosRequestHeaders | undefined {
    if (!headers) {
        return undefined;
    }

    const normalized: RawAxiosRequestHeaders = {};

    for (const [key, value] of Object.entries(headers)) {
        if (value === undefined) {
            continue;
        }

        if (Array.isArray(value)) {
            normalized[key] = value.join(', ');
        } else if (typeof value === 'string' || typeof value === 'number') {
            normalized[key] = value;
        }
    }

    return normalized;
}

function normalizeResponseHeaders(headers: Record<string, unknown>): Record<string, string> {
    const normalized: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
        if (typeof value === 'string') {
            normalized[key] = value;
        } else if (typeof value === 'number') {
            normalized[key] = String(value);
        } else if (Array.isArray(value)) {
            normalized[key] = value.join(', ');
        }
    }

    return normalized;
}

function isStreamLike(value: unknown): value is IncomingMessage {
    return (
        value !== null &&
        typeof value === 'object' &&
        typeof (value as {pipe?: unknown}).pipe === 'function'
    );
}

async function readErrorBody(data: unknown, headers: Record<string, unknown>): Promise<unknown> {
    if (data === null || data === undefined) {
        return data;
    }

    if (isStreamLike(data)) {
        return new Promise((resolve) => {
            const chunks: Buffer[] = [];

            data.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });

            data.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const body = buffer.toString('utf-8');
                const contentType = headers['content-type'];

                if (typeof contentType === 'string' && contentType.includes('application/json')) {
                    try {
                        resolve(JSON.parse(body));
                    } catch {
                        resolve(body);
                    }
                } else {
                    resolve(body);
                }
            });

            data.on('error', () => {
                resolve({});
            });
        });
    }

    return data;
}

export class RequestAxios {
    private static axiosInstance: AxiosInstance;
    private static appConfig: AppConfig;

    static init({
        cacheClientInstance,
        config: appConfig,
    }: {
        cacheClientInstance: CacheClient;
        config: AppConfig;
    }) {
        cacheClient = cacheClientInstance;
        this.appConfig = appConfig;
        this.axiosInstance = getAxios(appConfig);
    }

    static request({
        requestOptions,
        useCaching = false,
        requestControl,
    }: {
        requestOptions: RequestOptions | CachedRequestOptions;
        useCaching?: boolean;
        requestControl: {
            allBuffersLength: number;
        };
    }) {
        const {signal} = requestOptions;

        if (signal?.aborted === true) {
            throw new Error(signal.reason);
        }

        function dataLengthCheck(requestInstance: RequestInstanceLike) {
            let bufferLength = 0;

            return function (chunk: Buffer | string) {
                const {length} = chunk;

                bufferLength += length;
                requestControl.allBuffersLength += length;

                if (
                    requestControl.allBuffersLength > ALL_REQUESTS_SIZE_LIMIT ||
                    bufferLength > REQUEST_SIZE_LIMIT
                ) {
                    if (requestInstance._started === true) {
                        requestInstance.abort();
                    }

                    const error = new Error(
                        bufferLength > REQUEST_SIZE_LIMIT
                            ? REQUEST_SIZE_LIMIT_EXCEEDED
                            : ALL_REQUESTS_SIZE_LIMIT_EXCEEDED,
                    );

                    requestInstance.emit('error', error);
                }
            };
        }

        if (useCaching && isCachedRequestOptions(requestOptions)) {
            return this.cacheRequest({requestOptions, dataLengthCheck});
        } else {
            return this.directRequest({requestOptions, dataLengthCheck});
        }
    }

    static directRequest({
        requestOptions,
        dataLengthCheck,
    }: {
        requestOptions: RequestOptions;
        dataLengthCheck: (requestInstance: RequestInstanceLike) => (data: Buffer | string) => void;
    }) {
        const axiosConfig: AxiosRequestConfig = {
            ...this.mapRequestOptions(requestOptions),
            responseType: 'stream',
            signal: requestOptions.signal,
        };

        return this.getAxiosInstance()
            .request<IncomingMessage>(axiosConfig)
            .then((response) => {
                const stream = response.data;
                const chunks: Buffer[] = [];

                const requestInstance: RequestInstanceLike = {
                    abort: () => stream.destroy(),
                    emit: (event: string, error: Error) => {
                        if (event === 'error') {
                            stream.destroy(error);
                        }
                    },
                    _started: true,
                };

                const onData = dataLengthCheck(requestInstance);

                return new Promise<CachedResponseEnvelope>((resolve, reject) => {
                    stream.on('data', (chunk: Buffer) => {
                        chunks.push(chunk);
                        try {
                            onData(chunk);
                        } catch (error) {
                            const errorMessage = (error as Error).message;
                            if (
                                errorMessage === REQUEST_SIZE_LIMIT_EXCEEDED ||
                                errorMessage === ALL_REQUESTS_SIZE_LIMIT_EXCEEDED
                            ) {
                                const wrappedError = Object.assign(
                                    new Error(`Error: ${errorMessage}`),
                                    {code: errorMessage},
                                );
                                stream.destroy();
                                reject(wrappedError);
                            } else {
                                stream.destroy();
                                reject(error);
                            }
                        }
                    });

                    stream.on('end', () => {
                        const buffer = Buffer.concat(chunks);
                        const body = this.parseResponse(buffer, response.headers);

                        const result: CachedResponseEnvelope = {
                            statusCode: response.status,
                            body,
                            headers: normalizeResponseHeaders(
                                response.headers as Record<string, unknown>,
                            ) as IncomingHttpHeaders,
                        };

                        resolve(result);
                    });

                    stream.on('error', (error) => {
                        reject(error);
                    });
                });
            })
            .catch(async (error) => {
                throw await this.normalizeError(error);
            });
    }

    static cacheRequest({
        requestOptions,
        dataLengthCheck,
    }: {
        requestOptions: CachedRequestOptions;
        dataLengthCheck: (requestInstance: RequestInstanceLike) => (data: Buffer | string) => void;
    }) {
        const {uri, ctx, cacheKeyPrefix} = requestOptions;
        let {spCacheDuration, useCaching} = requestOptions;

        const parsedDuration = parseCacheDuration(spCacheDuration);
        const durationTime = parsedDuration === null ? NaN : parsedDuration;
        const removingCondition =
            spCacheDuration && Number.isFinite(durationTime) && durationTime < 7;

        const maxValue = 5184000;

        if (
            spCacheDuration &&
            (!isFinite(durationTime) || durationTime < 0 || durationTime > maxValue)
        ) {
            ctx.logError('Cache duration invalid', {uri: hideSensitiveData(uri)});

            useCaching = false;
            spCacheDuration = null;
        }

        let dataHash;
        if (requestOptions.body || requestOptions.form) {
            try {
                if (requestOptions.body) {
                    dataHash = crc32c(JSON.stringify(requestOptions.body));
                } else if (requestOptions.form) {
                    dataHash = crc32c(JSON.stringify(requestOptions.form));
                }
            } catch (error) {
                ctx.logError('Failed to calculate data hash', error);
            }
        }

        const keyPrefix = cacheKeyPrefix ? `${CACHE_PREFIX}:${cacheKeyPrefix}` : CACHE_PREFIX;
        let key = `${keyPrefix}:${hideSensitiveData(uri)}`;

        if (dataHash) {
            key += `:${dataHash}`;
        }

        const sequence = Promise.resolve();

        if (removingCondition) {
            sequence
                .then(() => {
                    return cacheClient.del({key});
                })
                .then(() => {
                    ctx.log('Cache value successfully removed', {key});
                })
                .catch(() => {
                    ctx.logError('Cache proxy deletion error', {key});
                });
        }

        const getData = (cacheServiceFailing: boolean) => {
            return this.directRequest({requestOptions, dataLengthCheck})
                .then((response) => {
                    const isCacheableStatus =
                        response.statusCode >= 200 && response.statusCode < 300;
                    if (
                        useCaching &&
                        !removingCondition &&
                        !cacheServiceFailing &&
                        isCacheableStatus
                    ) {
                        const envelope: CachedResponseEnvelope = {
                            statusCode: response.statusCode,
                            body: response.body,
                            headers: response.headers,
                        };
                        cacheClient
                            .set({key, value: envelope, ttl: durationTime})
                            .then(() => {
                                ctx.log('Cache set', {key, durationTime});
                            })
                            .catch((error) => {
                                ctx.logError('Cache set failed', error);
                            });
                    }

                    ctx.log('CACHE_SENDING_VALUE_DIRECTLY', {uri: hideSensitiveData(uri)});

                    return response;
                })
                .catch((error) => {
                    if (error.response) {
                        ctx.logError('Cache proxy request error', error);

                        throw error;
                    } else {
                        throw error;
                    }
                });
        };

        return sequence
            .then(() => {
                if (useCaching && spCacheDuration) {
                    ctx.log('Cache getting value...', {key});

                    return cacheClient.get({key});
                } else {
                    return null;
                }
            })
            .catch((error) => {
                ctx.logError('Cache service failed', error);

                return {status: CacheClient.NOT_OK};
            })
            .then((cacheResponse) => {
                const cacheResponseStatus = cacheResponse && cacheResponse.status;

                if (
                    cacheResponseStatus === CacheClient.OK &&
                    cacheResponse &&
                    'data' in cacheResponse &&
                    cacheResponse.data !== undefined
                ) {
                    ctx.log('Cache successfully recovered', {key});

                    const cached = cacheResponse.data as CachedResponseEnvelope | unknown;
                    if (
                        cached &&
                        typeof cached === 'object' &&
                        'statusCode' in cached &&
                        'body' in cached
                    ) {
                        const envelope = cached as CachedResponseEnvelope;
                        return {
                            statusCode: envelope.statusCode,
                            body: envelope.body,
                            headers: {
                                ...(envelope.headers || {}),
                                'x-charts-from-cache': '1',
                            },
                        };
                    }

                    return {
                        statusCode: 200,
                        body: cached,
                        headers: {'x-charts-from-cache': '1'},
                    };
                } else {
                    if (useCaching) {
                        ctx.log(
                            'Cache failed, requesting without cache',
                            cacheResponse ?? undefined,
                        );
                    } else {
                        ctx.log('Cache disabled, requesting without cache');
                    }

                    return getData(cacheResponseStatus === CacheClient.NOT_OK);
                }
            })
            .catch((error) => {
                ctx.logError('Cache proxy error', error);

                throw error;
            });
    }

    private static mapRequestOptions(options: RequestOptions): AxiosRequestConfig {
        const normalizedHeaders = normalizeHeaders(options.headers);

        const axiosConfig: AxiosRequestConfig = {
            url: options.uri || options.url,
            method: options.method,
            headers: normalizedHeaders,
            timeout: options.timeout,
            maxRedirects: options.maxRedirects ?? 0,
            beforeRedirect: (redirectOptions) => {
                // Preserve all original headers on redirect (matches request-promise-native behavior)
                if (normalizedHeaders) {
                    Object.assign(redirectOptions.headers, normalizedHeaders);
                }
            },
        };

        if (options.body !== undefined) {
            axiosConfig.data = options.body;
        }

        if (options.form !== undefined) {
            axiosConfig.data =
                typeof options.form === 'string'
                    ? options.form
                    : querystring.stringify(
                          options.form as Record<string, string | number | boolean>,
                      );
            axiosConfig.headers = {
                ...axiosConfig.headers,
                'content-type': 'application/x-www-form-urlencoded',
            };
        }

        if (options.qs) {
            axiosConfig.params = options.qs;
        }

        return axiosConfig;
    }

    private static parseResponse(buffer: Buffer, headers: Record<string, unknown>): unknown {
        const body = buffer.toString('utf-8');
        const contentType = headers['content-type'];

        if (
            typeof body === 'string' &&
            // Stat in qloud do no return content-type with code 204
            typeof contentType === 'string' &&
            contentType.indexOf('application/json') > -1
        ) {
            try {
                return JSON.parse(body);
            } catch (e) {
                return body;
            }
        }

        return body;
    }

    private static async normalizeError(error: unknown): Promise<
        Error & {
            statusCode?: number;
            code?: string;
            response?: {
                statusCode: number;
                body: unknown;
                headers: Record<string, string>;
                req?: {
                    headers: Record<string, unknown>;
                };
                request?: {
                    headers: Record<string, unknown>;
                };
            };
        }
    > {
        if (axios.isAxiosError(error)) {
            // Serialize only primitive values from headers to avoid circular references
            const safeHeaders = error.config?.headers
                ? normalizeHeaders(error.config.headers as OutgoingHttpHeaders)
                : undefined;

            const responseHeaders = error.response?.headers as Record<string, unknown>;
            const body = error.response
                ? await readErrorBody(error.response.data, responseHeaders || {})
                : undefined;

            const normalized = Object.assign(new Error(error.message), {
                statusCode: error.response?.status,
                code: error.code,
                stack: error.stack,
                response: error.response
                    ? {
                          statusCode: error.response.status,
                          body,
                          headers: normalizeResponseHeaders(responseHeaders || {}),
                          req: safeHeaders ? {headers: safeHeaders} : undefined,
                          request: safeHeaders ? {headers: safeHeaders} : undefined,
                      }
                    : undefined,
            });

            return normalized;
        }

        if (error instanceof Error) {
            return error;
        }

        return new Error(String(error));
    }

    private static getAxiosInstance(): AxiosInstance {
        if (!this.axiosInstance) {
            if (!this.appConfig) {
                throw new Error(
                    'RequestAxios not initialized. Call RequestAxios.init() before making requests.',
                );
            }
            this.axiosInstance = getAxios(this.appConfig);
        }
        return this.axiosInstance;
    }
}
