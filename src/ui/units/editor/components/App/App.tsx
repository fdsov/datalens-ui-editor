import React from 'react';

import {Redirect, Route, Switch} from 'react-router-dom';
import type {RouteComponentProps} from 'react-router-dom';

import withInaccessibleOnMobile from '../../../../hoc/withInaccessibleOnMobile';
import {EditorUrls} from '../../constants/common';
import EditorPage from '../../containers/EditorPage/EditorPage';
import {getFullPathName} from '../../utils';
import NewChart from '../NewChart/NewChart';

const EditorPageView = EditorPage as unknown as React.ComponentType<RouteComponentProps<any>>;

type AppRouteProps = RouteComponentProps<{workbookId?: string; path?: string; template?: string}>;

function App() {
    return (
        <React.Fragment>
            <Switch>
                <Route
                    path={['/editor/new', '/workbooks/:workbookId/editor/new']}
                    exact={true}
                    component={(props: AppRouteProps) => (
                        <NewChart workbookId={props.match.params.workbookId} />
                    )}
                />
                <Route
                    path={['/editor/draft', '/workbooks/:workbookId/editor/draft']}
                    exact={true}
                    component={(props: AppRouteProps) => (
                        <Redirect
                            to={{
                                pathname: getFullPathName({
                                    base: EditorUrls.NewEntry,
                                    workbookId: props.match.params.workbookId,
                                }),
                                search: props.location.search,
                            }}
                        />
                    )}
                />
                <Route
                    path={[
                        '/editor/:path/:template?',
                        '/workbooks/:workbookId/editor/:path/:template?',
                    ]}
                    component={EditorPageView}
                />
                <Route
                    path={['/editor', '/workbooks/:workbookId/editor']}
                    component={(props: AppRouteProps) => {
                        const {workbookId} = props.match.params;
                        return (
                            <Redirect
                                to={{
                                    pathname: getFullPathName({
                                        base: EditorUrls.NewEntry,
                                        workbookId,
                                    }),
                                    search: props.location.search,
                                }}
                            />
                        );
                    }}
                />
            </Switch>
        </React.Fragment>
    );
}

export default withInaccessibleOnMobile(App);
