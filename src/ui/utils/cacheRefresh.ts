export const FORCE_RELOAD_CHARTS_EVENT = 'dl:force-reload-charts';

const pendingNoCacheKeys = new Set<string>();
const GLOBAL_NO_CACHE_KEY = '*';

export function markChartNoCacheOnce(chartKey?: string | null) {
    pendingNoCacheKeys.add(chartKey ? String(chartKey) : GLOBAL_NO_CACHE_KEY);
}

export function consumeChartNoCacheOnce(chartKey?: string | null): boolean {
    if (chartKey && pendingNoCacheKeys.has(String(chartKey))) {
        pendingNoCacheKeys.delete(String(chartKey));
        return true;
    }
    if (pendingNoCacheKeys.has(GLOBAL_NO_CACHE_KEY)) {
        pendingNoCacheKeys.delete(GLOBAL_NO_CACHE_KEY);
        return true;
    }
    return false;
}

export function resetPendingNoCache() {
    pendingNoCacheKeys.clear();
}

export type InvalidateServerCachePayload = {
    workbookId?: string;
    datasetIds?: string[];
    connectionIds?: string[];
    flushAll?: boolean;
};

export async function invalidateServerCache(
    payload: InvalidateServerCachePayload = {},
): Promise<{ok: boolean; deletedUiKeys?: number; deletedDataApiKeys?: number}> {
    const response = await fetch('/api/cache/invalidate', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Cache invalidation failed with status ${response.status}`);
    }

    return response.json();
}

export function triggerDashboardChartsReload() {
    window.dispatchEvent(new CustomEvent(FORCE_RELOAD_CHARTS_EVENT));
}
