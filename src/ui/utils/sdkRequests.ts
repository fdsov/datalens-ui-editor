import type {
    CollectChartkitStatsArgs,
    CollectDashStatsArgs,
    GetDistinctsApiV2Args,
    GetDistinctsApiV2InfoHeadersArg,
    GetDistinctsApiV2TransformedResponse,
} from 'shared/schema/types';
import {Feature} from 'shared/types';
import {DL} from 'ui/constants/common';
import {getSdk} from 'ui/libs/schematic-sdk';

import {getSecureEmbeddingToken, isEmbeddedEntry} from './embedded';
import {isEnabledFeature} from './isEnabledFeature';
import {getRenderMarkdownResultFn} from './markdown/get-render-markdown-fn';

export const fetchDistinctsByApi = (
    params: GetDistinctsApiV2Args,
    headers?: GetDistinctsApiV2InfoHeadersArg,
): Promise<GetDistinctsApiV2TransformedResponse> => {
    return isEnabledFeature(Feature.UsePublicDistincts)
        ? getSdk().sdk.bi.getPublicDistinctsApiV2(params, {headers})
        : getSdk().sdk.bi.getDistinctsApiV2(params, {headers});
};

export const fetchBatchRenderedMarkdown = async (texts: Record<string, string>) => {
    if (isEmbeddedEntry() && getSecureEmbeddingToken()) {
        const renderMarkdown = await getRenderMarkdownResultFn();
        return Object.fromEntries(
            Object.entries(texts).map(([key, text]) => [key, renderMarkdown(text)]),
        );
    }
    return getSdk().sdk.mix.batchRenderMarkdown({
        texts,
        lang: DL.USER_LANG,
    });
};

export const fetchRenderedMarkdown = async (text: string) => {
    // Signed embeds have no browser session. Render already-authorized dashboard text
    // with the same sanitized renderer used by charts, without calling the session API.
    if (isEmbeddedEntry() && getSecureEmbeddingToken()) {
        const renderMarkdown = await getRenderMarkdownResultFn();
        return renderMarkdown(text);
    }
    return getSdk().sdk.mix.renderMarkdown({
        text,
        lang: DL.USER_LANG,
    });
};

export const requestCollectDashStats = (dashStats: CollectDashStatsArgs) => {
    return getSdk().sdk.mix.collectDashStats(dashStats);
};

export const requestCollectChartkitStats = (chartkitStats: CollectChartkitStatsArgs) => {
    return getSdk().sdk.mix.collectChartkitStats(chartkitStats);
};
