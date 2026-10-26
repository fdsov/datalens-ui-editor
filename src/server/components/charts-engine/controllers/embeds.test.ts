import type {AppContext} from '@gravity-ui/nodekit';

import secureParamsFeature from '../../features/features-list/EnableSecureParamsV2';
import type {EmbeddingInfo} from '../components/storage/types';

import {filterParams} from './embeds';

describe('embedded chart parameter boundaries', () => {
    const ctx = {get: () => () => true} as unknown as AppContext;
    const info = (publicParamsMode: boolean, privateParams: string[] = ['partner_id']) =>
        ({
            embed: {publicParamsMode, privateParams, unsignedParams: ['period', 'partner_id']},
            token: {params: {partner_id: 'signed-partner'}},
        }) as unknown as EmbeddingInfo;

    test('secure parameter precedence is enabled in production', () => {
        expect(secureParamsFeature.state.production).toBe(true);
    });

    test.each([false, true])('signed parameters win in publicParamsMode=%s', async (publicMode) => {
        const result = await filterParams({
            ctx,
            embeddingInfo: info(publicMode, []),
            params: {partner_id: 'another-partner', period: 'month'},
        });
        expect(result.params).toEqual({partner_id: 'signed-partner', period: 'month'});
    });

    test('blocks a private filter supplied by the client even if the token omits it', async () => {
        const result = await filterParams({
            ctx,
            embeddingInfo: info(false, ['partner_id', 'region']),
            params: {partner_id: 'attacker', region: 'all', period: 'month'},
        });
        expect(result.params).toEqual({partner_id: 'signed-partner', period: 'month'});
        expect(result.privateParams).toEqual(new Set(['partner_id', 'region']));
    });

    test('only accepts explicitly permitted unsigned parameters in public mode', async () => {
        const result = await filterParams({
            ctx,
            embeddingInfo: info(true),
            params: {period: 'month', region: 'all'},
        });
        expect(result.params).toEqual({period: 'month', partner_id: 'signed-partner'});
    });

    test('keeps signed filters when the client sends no parameters', async () => {
        const result = await filterParams({ctx, embeddingInfo: info(false), params: {}});
        expect(result.params).toEqual({partner_id: 'signed-partner'});
    });
});
