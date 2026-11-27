import React from 'react';

import block from 'bem-cn-lite';
import {useRouteMatch} from 'react-router-dom';

import NavigationBase from '../../../components/Navigation/Base/NavigationBase';
import NavigationInline from '../../../components/Navigation/Core/NavigationInline';
import {PLACE} from '../../../components/Navigation/constants';
import {getSdk} from '../../../libs/schematic-sdk';

import './EntriesNavigationPage.scss';

const b = block('dl-entries-navigation-page');

const ROUTE_TO_PLACE: Record<string, string> = {
    dashboards: PLACE.DASHBOARDS,
    charts: PLACE.WIDGETS,
    widgets: PLACE.WIDGETS,
    datasets: PLACE.DATASETS,
    connections: PLACE.CONNECTIONS,
    favorites: PLACE.FAVORITES,
};

const EntriesNavigationPage = () => {
    const match = useRouteMatch<{place: string}>('/:place');
    const routeKey = match?.params.place || 'dashboards';
    const place = ROUTE_TO_PLACE[routeKey] || PLACE.DASHBOARDS;

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
            />
        </div>
    );
};

export default EntriesNavigationPage;
