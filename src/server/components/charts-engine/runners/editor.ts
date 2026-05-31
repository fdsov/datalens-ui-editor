import {type AppContext, USER_LANGUAGE_PARAM_NAME} from '@gravity-ui/nodekit';

import {getServerFeatures} from '../../../../shared';
import {getTranslationFn} from '../../../../shared/modules/language';
import {registry} from '../../../registry';
import {createI18nInstance} from '../../../utils/language';
import {getIsolatedSandboxChartBuilder} from '../components/processor/isolated-sandbox/isolated-sandbox-chart-builder';

import {commonRunner} from './common';

import type {RunnerHandler, RunnerHandlerProps} from '.';

const DEFAULT_USER_LANG = 'ru';

export const runEditor: RunnerHandler = async (cx: AppContext, props: RunnerHandlerProps) => {
    const {chartsEngine, req, runnerLocals, config, configResolving, workbookId, forbiddenFields} =
        props;

    const ctx = cx.create('editorChartRunner');
    const hrStart = process.hrtime();

    const {widgetConfig} = req.body;
    const userLang = cx.get(USER_LANGUAGE_PARAM_NAME) || DEFAULT_USER_LANG;

    const i18n = createI18nInstance({lang: userLang});
    const getTranslation = getTranslationFn(i18n.getI18nServer());
    const serverFeatures = getServerFeatures(cx);
    const getAvailablePalettesMap = registry.common.functions.get('getAvailablePalettesMap');
    const getQLConnectionTypeMap = registry.getQLConnectionTypeMap;

    const chartBuilder = await getIsolatedSandboxChartBuilder({
        userLang,
        userLogin: runnerLocals.login || '',
        widgetConfig,
        config: config as {data: Record<string, string>; meta: {stype: string}; key: string},
        isScreenshoter: Boolean(req.headers['x-charts-scr']),
        nativeModules: {},
        serverFeatures,
        getTranslation,
        getAvailablePalettesMap,
        getQLConnectionTypeMap,
    });

    return commonRunner({
        runnerLocals,
        req,
        ctx,
        chartsEngine,
        configResolving,
        builder: chartBuilder,
        generatedConfig: config as Parameters<typeof commonRunner>[0]['generatedConfig'],
        workbookId,
        runnerType: 'Editor',
        hrStart,
        localConfig: config as Parameters<typeof commonRunner>[0]['localConfig'],
        subrequestHeadersKind: 'editor',
        forbiddenFields,
    });
};
