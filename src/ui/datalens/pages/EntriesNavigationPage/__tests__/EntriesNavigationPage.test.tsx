import React from 'react';

import {ThemeProvider} from '@gravity-ui/uikit';
import {cleanup, fireEvent, render, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {Provider} from 'react-redux';
import {Route, Router} from 'react-router-dom';
import {applyMiddleware, createStore} from 'redux';
import thunk from 'redux-thunk';
import {CollectionItemEntities, EntryScope, Feature} from 'shared';
import {DIALOG_CREATE_ENTRY_IN_WORKBOOK} from 'ui/components/CollectionsStructure';
import {DIALOG_COPY_ENTRIES_TO_WORKBOOK} from 'ui/components/CopyEntriesToWorkbookDialog';
import {resetAuthorFilterCache} from 'ui/components/Navigation/Core/AuthorFilterSelect/AuthorFilterSelect';
import {resetWorkbookFilterCache} from 'ui/components/Navigation/Core/WorkbookFilterSelect/WorkbookFilterSelect';
import {registerCommonPlugins} from 'ui/registry/units/common/register';

import EntriesNavigationPage from '../EntriesNavigationPage';

const mockGetNavigationList = jest.fn();
const mockGetStructureItems = jest.fn();
const mockGetWorkbookEntries = jest.fn();
const mockGetUsersList = jest.fn();
const mockAddFavorite = jest.fn();
const mockDeleteFavorite = jest.fn();
const mockOpenDialog = jest.fn((payload) => ({type: 'OPEN_DIALOG', payload}));
const mockCloseDialog = jest.fn(() => ({type: 'CLOSE_DIALOG'}));

jest.unmock('ui/utils/utils');

jest.mock('react-virtualized-auto-sizer', () => ({
    __esModule: true,
    default: ({children}: {children: (size: {width: number; height: number}) => React.ReactNode}) =>
        children({width: 1200, height: 600}),
}));

jest.mock('ui/libs/schematic-sdk', () => ({
    isSdkError: () => false,
    isOperationError: () => false,
    getSdk: () => ({
        sdk: {
            isCancel: () => false,
            mix: {
                getNavigationList: (...args: unknown[]) => mockGetNavigationList(...args),
            },
            us: {
                getStructureItems: (...args: unknown[]) => mockGetStructureItems(...args),
                getWorkbookEntries: (...args: unknown[]) => mockGetWorkbookEntries(...args),
                addFavorite: (...args: unknown[]) => mockAddFavorite(...args),
                deleteFavorite: (...args: unknown[]) => mockDeleteFavorite(...args),
            },
            auth: {
                getUsersList: (...args: unknown[]) => mockGetUsersList(...args),
                getUsersByIds: ({subjectIds}: {subjectIds: string[]}) =>
                    Promise.resolve({
                        users: subjectIds.map((userId) => ({
                            userId,
                            login: userId === 'user-2' ? 'anna_petrova' : 'ivan_kucenko',
                            email: null,
                            firstName: null,
                            lastName: null,
                            idpSlug: null,
                            idpType: null,
                        })),
                    }),
            },
        },
    }),
}));

jest.mock('ui/store/actions/dialog', () => ({
    openDialog: (payload: unknown) => mockOpenDialog(payload),
    closeDialog: () => mockCloseDialog(),
}));

const sampleDashEntry = {
    entryId: 'dash123',
    key: 'wb1/Media - Streamers and SEO',
    name: 'Media - Streamers and SEO',
    scope: EntryScope.Dash,
    type: '',
    createdAt: '2026-11-19T10:00:00.000Z',
    createdBy: 'ivan_kucenko',
    workbookId: 'wb1',
    workbookTitle: 'Media Marketing',
    isFavorite: false,
    isLocked: false,
    permissions: {
        admin: true,
        edit: true,
        read: true,
        execute: true,
    },
};

function setupWindowDL() {
    (window as unknown as {DL: Record<string, unknown>}).DL = {
        env: 'development',
        deviceType: 'desktop',
        installationType: 'opensource',
        endpoints: {
            navigation: '/navigation',
            connections: '/connections',
            dataset: '/datasets',
            wizard: '/wizard',
            ql: '/ql',
            dash: '/dashboards',
            widgets: '/widgets',
            preview: '/preview',
            editor: '/editor',
        },
        features: {
            [Feature.CopyEntriesToWorkbook]: true,
        },
        dynamicFeatures: {},
        user: {
            lang: 'ru',
            uid: 'user-1',
            formattedLogin: 'ivan_kucenko',
            displayName: 'Ivan',
        },
        userSettings: {},
        tenantMode: {
            workbooksEnabled: true,
        },
        isAuthEnabled: true,
    };
}

function renderPage(initialPath: string) {
    const history = createMemoryHistory({initialEntries: [initialPath]});
    const store = createStore(
        () => ({
            asideHeader: {
                asideHeaderData: {},
                isCompact: false,
                isHidden: false,
            },
            entryContent: {
                data: null,
            },
            user: {
                settings: {
                    data: {},
                },
            },
            dialog: {
                dialogs: [],
            },
            auth: {
                usersByIds: {
                    users: {
                        'user-1': {
                            loading: false,
                            error: null,
                            data: {
                                source: 'user',
                                subject: {
                                    userId: 'user-1',
                                    login: 'ivan_kucenko',
                                    email: null,
                                    firstName: 'Ivan',
                                    lastName: 'Kucenko',
                                    idpSlug: null,
                                    idpType: null,
                                },
                            },
                        },
                        'user-2': {
                            loading: false,
                            error: null,
                            data: {
                                source: 'user',
                                subject: {
                                    userId: 'user-2',
                                    login: 'anna_petrova',
                                    email: null,
                                    firstName: 'Anna',
                                    lastName: 'Petrova',
                                    idpSlug: null,
                                    idpType: null,
                                },
                            },
                        },
                    },
                    queue: [],
                },
            },
        }),
        applyMiddleware(thunk),
    );

    const utils = render(
        <ThemeProvider theme="dark">
            <Provider store={store}>
                <Router history={history}>
                    <Route
                        exact
                        path={[
                            '/dashboards',
                            '/charts',
                            '/widgets',
                            '/datasets',
                            '/connections',
                            '/favorites',
                        ]}
                        component={EntriesNavigationPage}
                    />
                </Router>
            </Provider>
        </ThemeProvider>,
    );

    return {...utils, history};
}

describe('EntriesNavigationPage', () => {
    beforeAll(() => {
        setupWindowDL();
        registerCommonPlugins();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        resetWorkbookFilterCache();
        resetAuthorFilterCache();
        setupWindowDL();
        mockGetUsersList.mockResolvedValue({
            users: [
                {
                    userId: 'user-1',
                    login: 'ivan_kucenko',
                    firstName: 'Ivan',
                    lastName: 'Kucenko',
                    email: 'ivan@example.com',
                },
                {
                    userId: 'user-2',
                    login: 'anna_petrova',
                    firstName: 'Anna',
                    lastName: 'Petrova',
                    email: 'anna@example.com',
                },
            ],
        });
        mockGetStructureItems.mockImplementation(
            ({collectionId}: {collectionId: string | null}) => {
                if (collectionId === null) {
                    return Promise.resolve({
                        items: [
                            {
                                entity: CollectionItemEntities.COLLECTION,
                                collectionId: 'col1',
                                title: 'Marketing',
                            },
                            {
                                entity: CollectionItemEntities.WORKBOOK,
                                workbookId: 'wb2',
                                title: 'Finance Core',
                            },
                        ],
                    });
                }
                if (collectionId === 'col1') {
                    return Promise.resolve({
                        items: [
                            {
                                entity: CollectionItemEntities.WORKBOOK,
                                workbookId: 'wb1',
                                title: 'Media Marketing',
                            },
                        ],
                    });
                }
                return Promise.resolve({items: []});
            },
        );
        mockGetWorkbookEntries.mockResolvedValue({
            entries: [],
        });
        mockGetNavigationList.mockResolvedValue({
            entries: [sampleDashEntry],
            hasNextPage: false,
            breadCrumbs: [],
        });
    });

    afterEach(cleanup);

    test('renders workbook dashboard as SPA link without legacy checkboxes and opens context menu without crashing', async () => {
        const {container, findByText, getByText, queryByRole} = renderPage('/dashboards');

        await findByText('Media - Streamers and SEO');

        // Legacy folder checkboxes must be hidden in collections/workbooks mode
        expect(queryByRole('checkbox')).toBeNull();

        // Row must be a real SPA link pointing to the dashboard slug
        const link = container.querySelector('a.dl-core-navigation-table-view__link');
        expect(link).not.toBeNull();
        expect(link?.getAttribute('href')).toContain('/dash123');

        // Clicking context menu (...) must open the menu cleanly instead of crashing
        const contextButton = container.querySelector(
            '.dl-core-navigation-table-view__row-btns > .dl-core-navigation-table-view__row-btn:last-child',
        );
        expect(contextButton).not.toBeNull();
        fireEvent.click(contextButton!);

        const copyItem = await waitFor(() => getByText('value_copy'));
        expect(getByText('value_rename')).toBeTruthy();
        expect(getByText('value_duplicate')).toBeTruthy();
        expect(getByText('value_copy-link')).toBeTruthy();
        expect(getByText('value_copy-id')).toBeTruthy();
        expect(getByText('value_show-related-entities')).toBeTruthy();
        expect(getByText('value_delete')).toBeTruthy();

        // Clicking "Copy" opens the copy-to-workbook dialog
        fireEvent.click(copyItem);
        expect(mockOpenDialog).toHaveBeenCalledWith(
            expect.objectContaining({
                id: DIALOG_COPY_ENTRIES_TO_WORKBOOK,
                props: expect.objectContaining({
                    entryId: 'dash123',
                    open: true,
                }),
            }),
        );
    });

    test('clicking workbook badge navigates via SPA router without full reload', async () => {
        const {findByText, history} = renderPage('/dashboards');

        const workbookBadge = await findByText('Media Marketing');
        fireEvent.click(workbookBadge);

        expect(history.location.pathname).toBe('/workbooks/wb1');
    });

    test('clicking create connection opens workbook picker instead of redirecting to standalone route', async () => {
        mockGetNavigationList.mockResolvedValue({
            entries: [],
            hasNextPage: false,
            breadCrumbs: [],
        });

        const {findAllByText} = renderPage('/connections');

        const createButtons = await findAllByText('button_create-connection');
        fireEvent.click(createButtons[0]);

        expect(mockOpenDialog).toHaveBeenCalledWith(
            expect.objectContaining({
                id: DIALOG_CREATE_ENTRY_IN_WORKBOOK,
                props: expect.objectContaining({
                    entryType: 'connection',
                }),
            }),
        );
    });

    test('charts section create menu offers wizard, QL and editor options via workbook picker', async () => {
        mockGetNavigationList.mockResolvedValue({
            entries: [],
            hasNextPage: false,
            breadCrumbs: [],
        });

        const {findAllByText, findByText} = renderPage('/charts');

        const createButtons = await findAllByText('button_create-widget');
        fireEvent.click(createButtons[0]);

        const editorOption = await findByText('value_create-editor');
        expect(await findByText('value_create-wizard')).toBeTruthy();
        expect(await findByText('value_create-ql')).toBeTruthy();

        fireEvent.click(editorOption);

        expect(mockOpenDialog).toHaveBeenCalledWith(
            expect.objectContaining({
                id: DIALOG_CREATE_ENTRY_IN_WORKBOOK,
                props: expect.objectContaining({
                    entryType: 'editor',
                }),
            }),
        );
    });

    test('favorites section opens edit alias dialog when clicking the tag icon', async () => {
        mockGetNavigationList.mockResolvedValue({
            entries: [{...sampleDashEntry, isFavorite: true}],
            hasNextPage: false,
            breadCrumbs: [],
        });

        const {container, findByText} = renderPage('/favorites');

        await findByText('Media - Streamers and SEO');

        const aliasButton = container.querySelector(
            '.dl-core-navigation-favorites-alias__edit-favorites-alias-btn',
        );
        expect(aliasButton).not.toBeNull();
        fireEvent.click(aliasButton!);

        expect(await findByText('caption_add')).toBeTruthy();
    });

    test('filters dashboards by workbook via select, calls getWorkbookEntries and syncs URL query', async () => {
        mockGetWorkbookEntries.mockResolvedValue({
            entries: [
                {
                    ...sampleDashEntry,
                    entryId: 'dash-fin-1',
                    key: 'wb2/Quarterly P&L',
                    displayKey: 'wb2/Quarterly P&L',
                    name: undefined,
                    workbookId: 'wb2',
                    workbookTitle: undefined,
                },
            ],
        });

        const {findByTestId, findByText, history} = renderPage('/dashboards');

        await findByText('Media - Streamers and SEO');

        const workbookFilter = await findByTestId('navigation-workbook-filter');
        fireEvent.click(workbookFilter);

        const financeOption = await findByText('Finance Core');
        fireEvent.click(financeOption);

        expect(await findByText('Quarterly P&L')).toBeTruthy();
        expect(mockGetWorkbookEntries).toHaveBeenCalledWith(
            expect.objectContaining({
                workbookId: 'wb2',
                scope: EntryScope.Dash,
                includePermissionsInfo: true,
            }),
            expect.any(Object),
        );
        expect(history.location.search).toBe('?workbookId=wb2');
    });

    test('initializes workbook filter from URL query parameter on load', async () => {
        mockGetWorkbookEntries.mockResolvedValue({
            entries: [
                {
                    ...sampleDashEntry,
                    entryId: 'dash-fin-2',
                    key: 'wb2/Revenue Overview',
                    displayKey: 'wb2/Revenue Overview',
                    name: undefined,
                    workbookId: 'wb2',
                    workbookTitle: undefined,
                },
            ],
        });

        const {findByText} = renderPage('/dashboards?workbookId=wb2');

        expect(await findByText('Revenue Overview')).toBeTruthy();
        expect(
            await findByText('Finance Core', {selector: '.g-select-control__option-text'}),
        ).toBeTruthy();
        expect(
            await findByText('Finance Core', {
                selector: '.dl-core-navigation-table-view__parent-folder-name',
            }),
        ).toBeTruthy();
        expect(mockGetWorkbookEntries).toHaveBeenCalledWith(
            expect.objectContaining({
                workbookId: 'wb2',
                scope: EntryScope.Dash,
            }),
            expect.any(Object),
        );
    });

    test('filters favorites by selected workbook', async () => {
        mockGetNavigationList.mockResolvedValue({
            entries: [
                {...sampleDashEntry, isFavorite: true},
                {
                    ...sampleDashEntry,
                    entryId: 'dash-fin-fav',
                    name: 'Finance Favorite',
                    key: 'wb2/Finance Favorite',
                    workbookId: 'wb2',
                    workbookTitle: 'Finance Core',
                    isFavorite: true,
                },
            ],
            hasNextPage: false,
            breadCrumbs: [],
        });

        const {findByTestId, findByText, queryByText} = renderPage('/favorites');

        await findByText('Media - Streamers and SEO');
        await findByText('Finance Favorite');

        const workbookFilter = await findByTestId('navigation-workbook-filter');
        fireEvent.click(workbookFilter);

        const financeOption = await findByText('Finance Core', {
            selector: '.dl-core-navigation-workbook-filter__option-title',
        });
        fireEvent.click(financeOption);

        await waitFor(() => {
            expect(queryByText('Media - Streamers and SEO')).toBeNull();
        });
        expect(await findByText('Finance Favorite')).toBeTruthy();
    });

    test('filters dashboards by author via select, passes createdBy array and syncs URL query', async () => {
        const {findByTestId, findByText, history} = renderPage('/dashboards');

        await findByText('Media - Streamers and SEO');

        const authorFilter = await findByTestId('navigation-author-filter');
        fireEvent.click(authorFilter);

        const annaOption = await findByText('anna_petrova');
        fireEvent.click(annaOption);

        await waitFor(() => {
            expect(mockGetNavigationList).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    createdBy: expect.arrayContaining(['uid:user-2', 'user-2', 'anna_petrova']),
                }),
                expect.any(Object),
            );
        });
        expect(history.location.search).toBe('?author=uid%3Auser-2');
    });

    test('combines workbook and author filters on dashboards', async () => {
        mockGetWorkbookEntries.mockResolvedValue({
            entries: [
                {
                    ...sampleDashEntry,
                    entryId: 'dash-ivan',
                    key: 'wb2/Ivan Report',
                    displayKey: 'wb2/Ivan Report',
                    name: undefined,
                    createdBy: 'uid:user-1',
                    workbookId: 'wb2',
                    workbookTitle: undefined,
                },
                {
                    ...sampleDashEntry,
                    entryId: 'dash-anna',
                    key: 'wb2/Anna Report',
                    displayKey: 'wb2/Anna Report',
                    name: undefined,
                    createdBy: 'uid:user-2',
                    workbookId: 'wb2',
                    workbookTitle: undefined,
                },
            ],
        });

        const {findByText, queryByText} = renderPage(
            '/dashboards?workbookId=wb2&author=uid:user-2',
        );

        expect(await findByText('Anna Report')).toBeTruthy();
        expect(queryByText('Ivan Report')).toBeNull();
    });
});
