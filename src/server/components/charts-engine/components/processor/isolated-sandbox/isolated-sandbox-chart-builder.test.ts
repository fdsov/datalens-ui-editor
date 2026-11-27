import {ProcessorHooks} from '../hooks';

import {getIsolatedSandboxChartBuilder} from './isolated-sandbox-chart-builder';

describe('getIsolatedSandboxChartBuilder', () => {
    const createBuilder = (type: string, data: Record<string, string>) =>
        getIsolatedSandboxChartBuilder({
            userLogin: 'tester',
            userLang: 'ru',
            isScreenshoter: false,
            nativeModules: {},
            config: {
                data,
                meta: {stype: type},
                key: 'test/chart',
            },
            serverFeatures: {},
            getTranslation: (_keyset, key) => key,
            getAvailablePalettesMap: () => ({}),
            getQLConnectionTypeMap: () => ({}),
        });

    test('resolves Editor.getId from config.data.meta.links in Urls tab', async () => {
        const builder = await createBuilder('table_node', {
            meta: JSON.stringify({links: {PG: '9qpuryly00vit'}}),
            url: `module.exports = {
                sql: {
                    url: '/_bi_connections/' + Editor.getId('PG') + '/dashsql',
                },
            };`,
        });

        try {
            const hooks = new ProcessorHooks({processorHooks: []});
            const result = await builder.buildUrls({
                hooks,
                params: {},
                actionParams: {},
            });

            expect(result.exports).toEqual({
                sql: {
                    url: '/_bi_connections/9qpuryly00vit/dashsql',
                },
            });
        } finally {
            builder.dispose();
        }
    });

    test('executes Config tab stored under config.data.config for table_node and d3_node', async () => {
        const hooks = new ProcessorHooks({processorHooks: []});

        const tableBuilder = await createBuilder('table_node', {
            config: 'module.exports = {title: "Cohort heatmap", paginator: {enabled: false}};',
        });
        try {
            const result = await tableBuilder.buildChartConfig({
                hooks,
                params: {},
                actionParams: {},
            });
            expect(result.exports).toEqual({
                title: 'Cohort heatmap',
                paginator: {enabled: false},
            });
        } finally {
            tableBuilder.dispose();
        }

        const d3Builder = await createBuilder('d3_node', {
            config: 'module.exports = {title: "D3 chart"};',
        });
        try {
            const result = await d3Builder.buildChartConfig({
                hooks,
                params: {},
                actionParams: {},
            });
            expect(result.exports).toEqual({
                title: 'D3 chart',
            });
        } finally {
            d3Builder.dispose();
        }
    });
});
