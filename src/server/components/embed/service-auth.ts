import type {NextFunction, Request, Response} from '@gravity-ui/expresskit';
import type {AppContext} from '@gravity-ui/nodekit';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import setCookieParser from 'set-cookie-parser';

import {ACCESS_TOKEN_TIME_RESERVE} from '../../../shared/components/auth/constants/token';
import {getAuthCookieName} from '../../../shared/components/auth/utils';
import {TIMEOUT_10_SEC} from '../../../shared/constants/timeout';
import {ALGORITHMS} from '../auth/middlewares/auth/constants';
import type {AccessTokenPayload} from '../auth/types/token';
import type {CtxUser} from '../auth/types/user';

/**
 * Self-hosted data-api has no embedding mode of its own (it only knows `_is_public`),
 * so data requests made on behalf of an embedded object cannot be authorized by the
 * embedding token itself. Instead the BFF performs them under a dedicated service user.
 *
 * Credentials are taken from the environment, the resulting access token is kept in the
 * process memory only and is never logged.
 */

export const EMBED_SERVICE_LOGIN_ENV = 'EMBED_SERVICE_LOGIN';
export const EMBED_SERVICE_PASSWORD_ENV = 'EMBED_SERVICE_PASSWORD';

export class EmbedServiceAuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EmbedServiceAuthError';
    }
}

type ServiceSession = {
    user: CtxUser;
    /** Unix seconds */
    expiresAt: number;
    /** Raw `Cookie` header value used for the `/refresh` call. */
    cookieHeader: string;
};

let session: ServiceSession | null = null;
/** Single shared promise so that concurrent requests trigger only one signin/refresh. */
let pendingSession: Promise<ServiceSession> | null = null;

export function isEmbedServiceAuthConfigured() {
    return Boolean(process.env[EMBED_SERVICE_LOGIN_ENV] && process.env[EMBED_SERVICE_PASSWORD_ENV]);
}

/** Exported for tests / hot reconfiguration. */
export function resetEmbedServiceAuth() {
    session = null;
    pendingSession = null;
}

function isFresh(current: ServiceSession) {
    const now = Math.floor(Date.now() / 1000);
    return now + ACCESS_TOKEN_TIME_RESERVE < current.expiresAt;
}

function buildCookieHeader(setCookieHeader: string | string[] | undefined) {
    if (!setCookieHeader) {
        return '';
    }

    return setCookieParser
        .parse(setCookieParser.splitCookiesString(setCookieHeader))
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join('; ');
}

function extractAccessToken(args: {
    ctx: AppContext;
    setCookieHeader: string | string[] | undefined;
}) {
    const {ctx, setCookieHeader} = args;
    const authCookieName = getAuthCookieName(ctx.config.authCookieName);

    const cookies = setCookieParser.parse(
        setCookieParser.splitCookiesString(setCookieHeader ?? []),
    );
    const authCookie = cookies.find((cookie) => cookie.name === authCookieName);

    if (!authCookie) {
        throw new EmbedServiceAuthError('Auth service response has no auth cookie');
    }

    let accessToken: string | undefined;
    try {
        ({accessToken} = JSON.parse(authCookie.value));
    } catch {
        throw new EmbedServiceAuthError('Auth cookie has unexpected format');
    }

    if (!accessToken) {
        throw new EmbedServiceAuthError('Auth cookie has no access token');
    }

    const payload = jwt.verify(accessToken, ctx.config.authTokenPublicKey || '', {
        algorithms: ALGORITHMS,
    }) as AccessTokenPayload;

    return {accessToken, payload};
}

async function requestSession(
    ctx: AppContext,
    mode: 'signin' | 'refresh',
): Promise<ServiceSession> {
    const authEndpoint = ctx.config.endpoints.api.auth;

    const isRefresh = mode === 'refresh';

    const response = await axios.request({
        url: `${authEndpoint}${isRefresh ? '/refresh' : '/signin'}`,
        method: 'post',
        timeout: TIMEOUT_10_SEC,
        // 4xx must be thrown as well, so that the caller can fall back to a full signin
        validateStatus: (status) => status >= 200 && status < 300,
        headers: isRefresh ? {cookie: session?.cookieHeader ?? ''} : {},
        data: isRefresh
            ? undefined
            : {
                  login: process.env[EMBED_SERVICE_LOGIN_ENV],
                  password: process.env[EMBED_SERVICE_PASSWORD_ENV],
              },
    });

    const setCookieHeader = response.headers['set-cookie'];
    const {accessToken, payload} = extractAccessToken({ctx, setCookieHeader});

    return {
        user: {
            userId: payload.userId,
            sessionId: payload.sessionId,
            accessToken,
            roles: payload.roles,
        },
        expiresAt: payload.exp,
        cookieHeader: buildCookieHeader(setCookieHeader),
    };
}

async function updateSession(ctx: AppContext): Promise<ServiceSession> {
    if (session?.cookieHeader) {
        try {
            return await requestSession(ctx, 'refresh');
        } catch (error) {
            // Do not leak credentials/tokens: only the error itself is logged
            ctx.logError('EMBED_SERVICE_AUTH_REFRESH_FAILED', error);
        }
    }

    return requestSession(ctx, 'signin');
}

/**
 * Returns the service user context, refreshing the cached token when needed.
 * Concurrent callers share a single in-flight request.
 */
export async function getEmbedServiceUser(ctx: AppContext): Promise<CtxUser> {
    if (!isEmbedServiceAuthConfigured()) {
        throw new EmbedServiceAuthError(
            `Embedded objects are not configured: ${EMBED_SERVICE_LOGIN_ENV} and ${EMBED_SERVICE_PASSWORD_ENV} are required`,
        );
    }

    if (session && isFresh(session)) {
        return session.user;
    }

    if (!pendingSession) {
        pendingSession = updateSession(ctx)
            .then((newSession) => {
                session = newSession;
                return newSession;
            })
            .finally(() => {
                pendingSession = null;
            });
    }

    const currentSession = await pendingSession;

    return currentSession.user;
}

/**
 * Puts the service user into the request context so that every outgoing data-api
 * request built by charts-engine (`addAuthHeaders`) is authorized by it.
 */
export async function embedServiceAuth(req: Request, res: Response, next: NextFunction) {
    if (!req.ctx.config.isAuthEnabled) {
        next();
        return;
    }

    try {
        const user = await getEmbedServiceUser(req.ctx);

        req.originalContext.set('userId', user.userId);
        req.originalContext.set('user', user);

        next();
    } catch (error) {
        req.ctx.logError('EMBED_SERVICE_AUTH_FAILED', error);

        const isConfigError =
            error instanceof EmbedServiceAuthError && !isEmbedServiceAuthConfigured();

        res.status(503).send({
            code: 'ERR.EMBEDS.SERVICE_AUTH_UNAVAILABLE',
            extra: {
                message: isConfigError
                    ? `Embedded objects are not configured on this installation: set ${EMBED_SERVICE_LOGIN_ENV} and ${EMBED_SERVICE_PASSWORD_ENV}`
                    : 'Failed to authorize embedded request',
                hideRetry: isConfigError,
            },
        });
    }
}
