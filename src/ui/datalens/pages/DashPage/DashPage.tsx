import React from 'react';
import {Switch, Route} from 'react-router-dom';
import {EMBEDDED_DASH_PATH} from 'shared';

import {App as DashApp} from 'units/dash/containers/App/App';
import dash from 'units/dash/store/reducers/dash';
import wizard from 'units/wizard/reducers';
import {reducerRegistry} from '../../../store';

import 'ui/styles/dash.scss';
import 'ui/styles/dl-monaco.scss';

reducerRegistry.register({
    dash,
    wizard,
});

const routePaths = [
    EMBEDDED_DASH_PATH,
    '/dashboards/new',
    '/workbooks/:workbookId/dashboards',
    '/workbooks/:workbookId/dash',
    '/:id',
];

const Dash = () => (
    <Switch>
        <Route path={routePaths} component={DashApp} />
    </Switch>
);

export default Dash;
