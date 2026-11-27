import React from 'react';

import {ThemeProvider} from '@gravity-ui/uikit';
import {cleanup, fireEvent, render, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {Provider} from 'react-redux';
import {Route, Router} from 'react-router-dom';
import {applyMiddleware, createStore} from 'redux';
import thunk from 'redux-thunk';
import {EntryScope, Feature} from 'shared';
import {DIALOG_CREATE_ENTRY_IN_WORKBOOK} from 'ui/components/CollectionsStructure';
import {DIALOG_COPY_ENTRIES_TO_WORKBOOK} from 'ui/components/CopyEntriesToWorkbookDialog';
import {registerCommonPlugins} from 'ui/registry/units/common/register';

import EntriesNavigationPage from '../EntriesNavigationPage';

const mockGetNavigationList = jest.fn();
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
                addFavorite: (...args: unknown[]) => mockAddFavorite(...args),
                deleteFavorite: (...args: unknown[]) => mockDeleteFavorite(...args),
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
                    users: {},
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
        setupWindowDL();
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
});
