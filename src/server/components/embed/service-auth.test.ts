import {generateKeyPairSync} from 'crypto';

import type {Request, Response} from '@gravity-ui/expresskit';
import type {AppContext} from '@gravity-ui/nodekit';
import axios from 'axios';
import jwt from 'jsonwebtoken';

import {getAuthCookieName} from '../../../shared/components/auth/utils';

import {embedServiceAuth, getEmbedServiceUser, resetEmbedServiceAuth} from './service-auth';

jest.mock('axios');

const request = jest.mocked(axios.request);
const {privateKey, publicKey} = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {type: 'spki', format: 'pem'},
    privateKeyEncoding: {type: 'pkcs8', format: 'pem'},
});
const ctx = {
    config: {
        isAuthEnabled: true,
        authTokenPublicKey: publicKey,
        endpoints: {api: {auth: 'https://auth.test'}},
    },
    logError: jest.fn(),
} as unknown as AppContext;

function authResponse(expiresIn = 3600) {
    const accessToken = jwt.sign(
        {userId: 'embed-service', sessionId: 'session', roles: ['datalens.viewer']},
        privateKey,
        {algorithm: 'PS256', expiresIn},
    );
    return {
        headers: {
            'set-cookie': [
                `${getAuthCookieName()}=${encodeURIComponent(JSON.stringify({accessToken}))}; Path=/; HttpOnly`,
                'refresh=private-refresh-token; Path=/; HttpOnly',
            ],
        },
    };
}

describe('embedding service authentication', () => {
    const originalLogin = process.env.EMBED_SERVICE_LOGIN;
    const originalPassword = process.env.EMBED_SERVICE_PASSWORD;

    beforeEach(() => {
        resetEmbedServiceAuth();
        jest.clearAllMocks();
        request.mockReset();
        process.env.EMBED_SERVICE_LOGIN = 'embed-service';
        process.env.EMBED_SERVICE_PASSWORD = 'private-password';
    });

    afterAll(() => {
        resetEmbedServiceAuth();
        for (const [key, value] of Object.entries({
            EMBED_SERVICE_LOGIN: originalLogin,
            EMBED_SERVICE_PASSWORD: originalPassword,
        })) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });

    test('shares one signin across concurrent requests and caches the verified user', async () => {
        request.mockResolvedValue(authResponse());
        const users = await Promise.all([getEmbedServiceUser(ctx), getEmbedServiceUser(ctx)]);
        expect(users[0].userId).toBe('embed-service');
        expect(users[1]).toBe(users[0]);
        expect(await getEmbedServiceUser(ctx)).toBe(users[0]);
        expect(request).toHaveBeenCalledTimes(1);
    });

    test('refreshes a near-expiry session using cookies instead of credentials', async () => {
        request.mockResolvedValueOnce(authResponse(60)).mockResolvedValueOnce(authResponse());
        await getEmbedServiceUser(ctx);
        await getEmbedServiceUser(ctx);
        expect(request).toHaveBeenLastCalledWith(
            expect.objectContaining({
                url: 'https://auth.test/refresh',
                data: undefined,
                headers: {cookie: expect.stringContaining('refresh=private-refresh-token')},
            }),
        );
    });

    test('falls back to signin without logging the failed refresh request or tokens', async () => {
        request
            .mockResolvedValueOnce(authResponse(60))
            .mockRejectedValueOnce({config: {headers: {cookie: 'private-refresh-token'}}})
            .mockResolvedValueOnce(authResponse());
        await getEmbedServiceUser(ctx);
        expect((await getEmbedServiceUser(ctx)).userId).toBe('embed-service');
        expect(request).toHaveBeenLastCalledWith(
            expect.objectContaining({url: 'https://auth.test/signin'}),
        );
        expect(ctx.logError).toHaveBeenCalledWith(
            'EMBED_SERVICE_AUTH_REFRESH_FAILED',
            expect.objectContaining({message: 'Service session refresh failed'}),
        );
        expect(JSON.stringify(jest.mocked(ctx.logError).mock.calls)).not.toContain(
            'private-refresh-token',
        );
    });

    test('rejects an expired access token returned by the auth service', async () => {
        request.mockResolvedValue(authResponse(-60));
        await expect(getEmbedServiceUser(ctx)).rejects.toThrow('jwt expired');
    });

    test('fails closed without forwarding credentials to the response or logs', async () => {
        const error = {
            config: {data: 'private-password', headers: {cookie: 'private-refresh-token'}},
        };
        request.mockRejectedValue(error);
        const next = jest.fn();
        const set = jest.fn();
        const send = jest.fn();
        const status = jest.fn().mockReturnValue({send});
        await embedServiceAuth(
            {ctx, originalContext: {set}} as unknown as Request,
            {status} as unknown as Response,
            next,
        );
        expect(status).toHaveBeenCalledWith(503);
        expect(next).not.toHaveBeenCalled();
        expect(set).not.toHaveBeenCalled();
        expect(ctx.logError).not.toHaveBeenCalledWith(expect.anything(), error);
        expect(JSON.stringify([send.mock.calls, jest.mocked(ctx.logError).mock.calls])).not.toMatch(
            /private-password|private-refresh-token/,
        );
    });

    test('does not contact auth when service credentials are missing', async () => {
        delete process.env.EMBED_SERVICE_PASSWORD;
        await expect(getEmbedServiceUser(ctx)).rejects.toThrow('not configured');
        expect(request).not.toHaveBeenCalled();
    });
});
