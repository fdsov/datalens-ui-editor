import {EMBED_TOKEN_HASH_KEY} from 'shared';

import {DL, EMBEDDED_MODE, URL_OPTIONS} from '../constants';

export const isIframe = () => {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
};

export const isEmbeddedEntry = () => Boolean(DL.EMBED);

export const isEmbeddedChartEntry = () => typeof DL.EMBED === 'object' && DL.EMBED.mode === 'chart';

export const isEmbeddedMode = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const isEmbeddedPreview = urlParams.get(URL_OPTIONS.EMBEDDED) === '1';
    const isEmbedded = urlParams.get('mode') === EMBEDDED_MODE.EMBEDDED;
    return isEmbeddedEntry() || isIframe() || isEmbedded || isEmbeddedPreview;
};

export const isTvMode = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const isTv = urlParams.get('mode') === EMBEDDED_MODE.TV;
    return isTv;
};

export const isNoScrollMode = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const isNoScrollEnabled = urlParams.get(URL_OPTIONS.NO_SCROLL) === '1';
    return isNoScrollEnabled && isEmbeddedMode();
};

/**
 * The embedding token is passed in the URL hash fragment, so it is never sent to the
 * server as part of the request line (it can only be attached explicitly as a header).
 */
export const getSecureEmbeddingToken = () => {
    const hash = window.location.hash.replace(/^#/, '');

    if (!hash) {
        return '';
    }

    return new URLSearchParams(hash).get(EMBED_TOKEN_HASH_KEY) || '';
};
