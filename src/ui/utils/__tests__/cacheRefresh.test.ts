import {
    FORCE_RELOAD_CHARTS_EVENT,
    consumeChartNoCacheOnce,
    markChartNoCacheOnce,
    resetPendingNoCache,
    triggerDashboardChartsReload,
} from '../cacheRefresh';

describe('ui/utils/cacheRefresh', () => {
    beforeEach(() => {
        resetPendingNoCache();
    });

    test('markChartNoCacheOnce marks a specific chart for a single uncached request', () => {
        expect(consumeChartNoCacheOnce('chart-1')).toBe(false);

        markChartNoCacheOnce('chart-1');
        expect(consumeChartNoCacheOnce('chart-2')).toBe(false);
        expect(consumeChartNoCacheOnce('chart-1')).toBe(true);
        expect(consumeChartNoCacheOnce('chart-1')).toBe(false);
    });

    test('triggerDashboardChartsReload dispatches FORCE_RELOAD_CHARTS_EVENT', () => {
        const listener = jest.fn();
        window.addEventListener(FORCE_RELOAD_CHARTS_EVENT, listener);
        try {
            triggerDashboardChartsReload();
            expect(listener).toHaveBeenCalledTimes(1);
        } finally {
            window.removeEventListener(FORCE_RELOAD_CHARTS_EVENT, listener);
        }
    });
});
