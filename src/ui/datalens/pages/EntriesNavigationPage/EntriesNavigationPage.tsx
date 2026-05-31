import React from 'react';

import block from 'bem-cn-lite';
import {useRouteMatch} from 'react-router-dom';

import {getPlaceParameters} from '../../../components/Navigation/Base/configure';
import NavigationEntries from '../../../components/Navigation/Core/NavigationEntries';
import {MODE_FULL, PLACE} from '../../../components/Navigation/constants';
import navigateHelper from '../../../libs/navigateHelper';
import {getSdk} from '../../../libs/schematic-sdk';

import './EntriesNavigationPage.scss';

const b = block('dl-entries-navigation-page');

const ROUTE_TO_PLACE: Record<string, string> = {
    dashboards: PLACE.DASHBOARDS,
    charts: PLACE.WIDGETS,
    datasets: PLACE.DATASETS,
    connections: PLACE.CONNECTIONS,
    favorites: PLACE.FAVORITES,
};

const onEntryClick = (entry: {
    entryId?: string;
    scope?: string;
    type?: string;
    key?: string;
}) => {
    if (entry.scope === 'folder') {
        return;
    }
    const link = navigateHelper.redirectUrlSwitcher({
        entryId: entry.entryId,
        scope: entry.scope,
        type: entry.type,
        key: entry.key,
    });
    if (link) {
        window.location.assign(link);
    }
};

const EntriesNavigationPage = () => {
    const match = useRouteMatch<{place: string}>('/:place');
    const routeKey = match?.params.place || 'dashboards';
    const place = ROUTE_TO_PLACE[routeKey] || PLACE.DASHBOARDS;

    return (
        <div className={b()}>
            <NavigationEntries
                key={place}
                sdk={getSdk()}
                mode={MODE_FULL}
                place={place}
                path=""
                ignoreWorkbookEntries={false}
                getPlaceParameters={getPlaceParameters}
                onEntryClick={onEntryClick}
            />
        </div>
    );
};

export default EntriesNavigationPage;
