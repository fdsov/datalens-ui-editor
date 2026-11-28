import React from 'react';

import block from 'bem-cn-lite';
import {useHistory, useLocation, useRouteMatch} from 'react-router-dom';

import NavigationBase from '../../../components/Navigation/Base/NavigationBase';
import NavigationInline from '../../../components/Navigation/Core/NavigationInline';
import {PLACE} from '../../../components/Navigation/constants';
import {getSdk} from '../../../libs/schematic-sdk';

import './EntriesNavigationPage.scss';

const b = block('dl-entries-navigation-page');

const WORKBOOK_ID_QUERY_PARAM = 'workbookId';
const AUTHOR_QUERY_PARAM = 'author';
const CHART_TYPE_QUERY_PARAM = 'chartType';

const ROUTE_TO_PLACE: Record<string, string> = {
    dashboards: PLACE.DASHBOARDS,
    charts: PLACE.WIDGETS,
    widgets: PLACE.WIDGETS,
    datasets: PLACE.DATASETS,
    connections: PLACE.CONNECTIONS,
    favorites: PLACE.FAVORITES,
};

function parseListQueryParam(search: string, paramName: string): string[] {
    const params = new URLSearchParams(search);
    return params
        .getAll(paramName)
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter(Boolean);
}

const EntriesNavigationPage = () => {
    const match = useRouteMatch<{place: string}>('/:place');
    const location = useLocation();
    const history = useHistory();
    const routeKey = match?.params.place || 'dashboards';
    const place = ROUTE_TO_PLACE[routeKey] || PLACE.DASHBOARDS;

    const initialWorkbookIds = React.useMemo(
        () => parseListQueryParam(location.search, WORKBOOK_ID_QUERY_PARAM),
        // Only read initial query when navigating to a new section (key={place} remounts)
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [place],
    );

    const initialAuthorIds = React.useMemo(
        () => parseListQueryParam(location.search, AUTHOR_QUERY_PARAM),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [place],
    );

    const initialChartTypes = React.useMemo(
        () => parseListQueryParam(location.search, CHART_TYPE_QUERY_PARAM),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [place],
    );

    const updateQueryParam = React.useCallback(
        (paramName: string, values: string[]) => {
            const params = new URLSearchParams(history.location.search);
            params.delete(paramName);
            if (values.length > 0) {
                params.set(paramName, values.join(','));
            }
            const nextSearch = params.toString();
            history.replace({
                pathname: history.location.pathname,
                search: nextSearch ? `?${nextSearch}` : '',
            });
        },
        [history],
    );

    const handleWorkbookFilterChange = React.useCallback(
        (workbookIds: string[]) => {
            updateQueryParam(WORKBOOK_ID_QUERY_PARAM, workbookIds);
        },
        [updateQueryParam],
    );

    const handleAuthorFilterChange = React.useCallback(
        (authorIds: string[]) => {
            updateQueryParam(AUTHOR_QUERY_PARAM, authorIds);
        },
        [updateQueryParam],
    );

    const handleChartTypeFilterChange = React.useCallback(
        (chartTypes: string[]) => {
            updateQueryParam(CHART_TYPE_QUERY_PARAM, chartTypes);
        },
        [updateQueryParam],
    );

    return (
        <div className={b()}>
            <NavigationBase
                key={place}
                sdk={getSdk()}
                navConstructor={NavigationInline}
                root={place}
                path=""
                hideSidebar={true}
                ignoreWorkbookEntries={false}
                isOnlyCollectionsMode={true}
                showWorkbookFilter={true}
                initialWorkbookIds={initialWorkbookIds}
                onWorkbookFilterChange={handleWorkbookFilterChange}
                showAuthorFilter={true}
                initialAuthorIds={initialAuthorIds}
                onAuthorFilterChange={handleAuthorFilterChange}
                showChartTypeFilter={place === PLACE.WIDGETS}
                initialChartTypes={initialChartTypes}
                onChartTypeFilterChange={handleChartTypeFilterChange}
            />
        </div>
    );
};

export default EntriesNavigationPage;
