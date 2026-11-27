import {EDITOR_TYPE} from 'shared/constants';
import {registry} from 'ui/registry';
import {isEnabledFeature} from 'ui/utils/isEnabledFeature';

import {Helper} from '../helper';

jest.mock('ui/utils/isEnabledFeature', () => ({
    isEnabledFeature: jest.fn(),
}));

const mockedIsEnabledFeature = isEnabledFeature as jest.MockedFunction<typeof isEnabledFeature>;

describe('editor/store/reducers/editor/Helper', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(registry.common.functions, 'get').mockImplementation((name: string) => {
            if (name === 'getDocPathPrefix') {
                return () => '/docs';
            }
            return jest.fn();
        });
        jest.spyOn(registry.editor.functions, 'get').mockImplementation((name: string) => {
            if (name === 'getEmptyTemplateType') {
                return () => EDITOR_TYPE.TABLE_NODE;
            }
            return jest.fn();
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('formEntryData', () => {
        it('preserves entry.data.meta, shared, and secrets when not present in scriptsValues', () => {
            const entry = {
                type: EDITOR_TYPE.TABLE_NODE,
                data: {
                    meta: '{"links":{"PG":"9qpuryly00vit"}}',
                    shared: '{"type":"table"}',
                    secrets: '{"API_KEY":"secret-ref"}',
                    sources: 'old sources',
                    url: 'legacy url',
                    js: 'legacy js',
                    ui: 'legacy ui',
                    table: 'legacy table',
                },
            };

            const scriptsValues = {
                sources: 'updated sources',
                params: '',
                prepare: 'module.exports = {};',
                controls: '',
                config: 'module.exports = {title: "New"};',
            };

            const result = Helper.formEntryData({scriptsValues, entry});

            expect(result).toEqual({
                sources: 'updated sources',
                params: '',
                prepare: 'module.exports = {};',
                controls: '',
                config: 'module.exports = {title: "New"};',
                meta: '{"links":{"PG":"9qpuryly00vit"}}',
                shared: '{"type":"table"}',
                secrets: '{"API_KEY":"secret-ref"}',
            });
            expect(result.url).toBeUndefined();
            expect(result.js).toBeUndefined();
            expect(result.ui).toBeUndefined();
            expect(result.table).toBeUndefined();
        });

        it('uses edited meta from scriptsValues instead of overwriting with entry.data.meta', () => {
            const entry = {
                type: EDITOR_TYPE.TABLE_NODE,
                data: {
                    meta: '{"links":{"PG":"old-id"}}',
                },
            };

            const scriptsValues = {
                meta: '{"links":{"PG":"new-id"}}',
                sources: 'module.exports = {};',
            };

            const result = Helper.formEntryData({scriptsValues, entry});

            expect(result).toEqual({
                meta: '{"links":{"PG":"new-id"}}',
                sources: 'module.exports = {};',
            });
        });

        it('allows clearing meta in scriptsValues when meta tab is active', () => {
            const entry = {
                type: EDITOR_TYPE.TABLE_NODE,
                data: {
                    meta: '{"links":{"PG":"old-id"}}',
                },
            };

            const scriptsValues = {
                meta: '',
                sources: 'module.exports = {};',
            };

            const result = Helper.formEntryData({scriptsValues, entry});

            expect(result.meta).toBe('');
        });
    });

    describe('createTabData', () => {
        it('includes Meta tab and populates scriptsValues.meta when EnableChartEditor is enabled', () => {
            mockedIsEnabledFeature.mockImplementation(
                (feature: string) => feature === 'EnableChartEditor',
            );

            const entry = {
                type: EDITOR_TYPE.TABLE_NODE,
                data: {
                    meta: '{"links":{"PG":"9qpuryly00vit"}}',
                    sources:
                        'module.exports = {sql: {url: `/_bi_connections/${Editor.getId("PG")}/dashsql`}};',
                    params: '',
                    prepare: 'module.exports = {};',
                    controls: '',
                    config: 'module.exports = {};',
                },
            };

            const {tabs, scriptsValues} = Helper.createTabData(entry) as {
                tabs: {allIds: string[]; byId: Record<string, unknown>};
                scriptsValues: Record<string, string>;
            };

            expect(tabs.allIds).toContain('meta');
            expect(tabs.byId.meta).toMatchObject({
                id: 'meta',
                name: 'Meta',
                language: 'json',
            });
            expect(scriptsValues.meta).toBe('{"links":{"PG":"9qpuryly00vit"}}');
        });
    });
});
