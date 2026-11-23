/** @jest-environment-options {"customExportConditions":["node","node-addons"]} */
import {ReadableStream, TransformStream, WritableStream} from 'node:stream/web';
import {TextDecoder, TextEncoder} from 'node:util';
import {MessageChannel, MessagePort} from 'node:worker_threads';

import {DL} from 'ui/constants';
import {getSdk} from 'ui/libs/schematic-sdk';
import {fetchBatchRenderedMarkdown, fetchRenderedMarkdown} from 'ui/utils/sdkRequests';

jest.mock('ui/constants', () => ({DL: {USER_LANG: 'en', EMBED: true}}));
jest.mock('ui/constants/common', () => require('ui/constants'));
jest.mock('ui/registry', () => ({
    registry: {
        common: {functions: {getAll: () => ({getAdditionalMarkdownPlugins: async () => []})}},
    },
}));
jest.mock('ui/libs/schematic-sdk', () => ({
    getSdk: () => ({sdk: {mix: mockMix}}),
}));

const mockMix = {
    renderMarkdown: jest.fn().mockResolvedValue({result: 'server single'}),
    batchRenderMarkdown: jest.fn().mockResolvedValue({heading: {result: 'server batch'}}),
};

describe('signed embed markdown', () => {
    beforeAll(() => {
        Object.assign(globalThis, {
            TextDecoder,
            TextEncoder,
            ReadableStream,
            WritableStream,
            TransformStream,
            MessageChannel,
            MessagePort,
        });
    });
    beforeEach(() => {
        jest.clearAllMocks();
        Object.defineProperty(DL, 'EMBED', {configurable: true, value: true});
        window.location.hash = '#dl_embed_token=synthetic-token';
    });
    afterEach(() => {
        window.location.hash = '';
    });

    it('renders a text block without calling the authenticated gateway', async () => {
        const rendered = await fetchRenderedMarkdown('**Cashdesks**');
        expect(rendered.result).toContain('<strong>Cashdesks</strong>');
        expect(getSdk().sdk.mix.renderMarkdown).not.toHaveBeenCalled();
    });

    it('renders every batch item and keeps unsafe HTML out of the result', async () => {
        const rendered = await fetchBatchRenderedMarkdown({
            heading: '**Overview**',
            unsafe: '<script>alert(1)</script> [link](javascript:alert(1))',
        });
        expect(Object.keys(rendered)).toEqual(['heading', 'unsafe']);
        expect(rendered.heading.result).toContain('<strong>Overview</strong>');
        expect(rendered.unsafe.result).not.toMatch(/<script|href=["']javascript:/i);
        expect(getSdk().sdk.mix.batchRenderMarkdown).not.toHaveBeenCalled();
    });

    it('keeps ordinary dashboard requests on the authenticated gateway', async () => {
        Object.defineProperty(DL, 'EMBED', {configurable: true, value: false});
        expect(await fetchRenderedMarkdown('text')).toEqual({result: 'server single'});
        expect(await fetchBatchRenderedMarkdown({heading: 'text'})).toEqual({
            heading: {result: 'server batch'},
        });
        expect(getSdk().sdk.mix.renderMarkdown).toHaveBeenCalledWith({text: 'text', lang: 'en'});
    });

    it('does not select signed rendering for an embed without a token', async () => {
        window.location.hash = '';
        expect(await fetchRenderedMarkdown('text')).toEqual({result: 'server single'});
    });
});
