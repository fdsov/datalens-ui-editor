import React from 'react';

import {Loader, SegmentedRadioGroup as RadioButton} from '@gravity-ui/uikit';
import cn from 'bem-cn-lite';
import {I18n} from 'i18n';
import debounce from 'lodash/debounce';
import noop from 'lodash/noop';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {filterUsersIds, getEntryNameByKey, makeUserId, normalizeDestination} from 'shared';
import {showToast} from 'store/actions/toaster';
import Tabs from 'ui/components/Tabs/Tabs';
import {DL} from 'ui/constants/common';
import {getResolveUsersByIdsAction} from 'ui/store/actions/usersByIds';
import {selectUsersByIds} from 'ui/units/auth/store/selectors/usersByIds';
import {MOBILE_SIZE} from 'ui/utils/mobile';

import logger from '../../../libs/logger';
import {getSdk} from '../../../libs/schematic-sdk';
import Utils from '../../../utils';
import {EntryContextMenuBase} from '../../EntryContextMenu';
import {EmptyState} from '../components/EmptyState/EmptyState';
import {
    MAP_PLACE_TO_SCOPE,
    MODE_FULL,
    MODE_MINIMAL,
    ORDER_DIRECTION,
    ORDER_FIELD,
    OWNERSHIP,
    PLACE,
} from '../constants';
import {NavigationSettings} from '../settings';

import {
    AuthorFilterSelect,
    buildAuthorOptionsFromEntries,
    fetchAccessibleAuthors,
    mergeAuthorOptions,
    resolveSelectedAuthorTokens,
} from './AuthorFilterSelect/AuthorFilterSelect';
import {
    ChartTypeFilterSelect,
    matchesChartTypeFilter,
} from './ChartTypeFilterSelect/ChartTypeFilterSelect';
import ErrorView from './ErrorView/ErrorView';
import OrderSelect from './OrderSelect/OrderSelect';
import SearchInput from './SearchInput/SearchInput';
import {TableView} from './TableView/TableView';
import {
    WorkbookFilterSelect,
    fetchAccessibleWorkbooks,
} from './WorkbookFilterSelect/WorkbookFilterSelect';

import './NavigationEntries.scss';

const b = cn('dl-core-navigation');
const i18n = I18n.keyset('component.navigation.view');

const mobileTabsItems = [
    {id: OWNERSHIP.ALL, title: i18n('label_mobile-navigation-filters-all')},
    {id: OWNERSHIP.ONLY_MINE, title: i18n('label_mobile-navigation-filters-mine')},
    {id: OWNERSHIP.FAVORITES, title: i18n('label_mobile-navigation-filters-favorites')},
];

const MOBILE_PLACES = [MAP_PLACE_TO_SCOPE[PLACE.DASHBOARDS], MAP_PLACE_TO_SCOPE[PLACE.WIDGETS]];

class NavigationEntries extends React.Component {
    static propTypes = {
        scope: PropTypes.string,
        path: PropTypes.string,
        place: PropTypes.string,
        mode: PropTypes.string,
        // used only in mobile navigation
        defaultPlace: PropTypes.string,

        clickableScope: PropTypes.string,
        inactiveEntryKeys: PropTypes.arrayOf(PropTypes.string),
        currentPageEntry: PropTypes.object,
        checkEntryActivity: PropTypes.func,

        linkWrapper: PropTypes.func,
        onEntryClick: PropTypes.func,
        onEntryParentClick: PropTypes.func,
        onChangeFavorite: PropTypes.func,
        onPlaceChange: PropTypes.func,
        setBreadCrumbs: PropTypes.func,

        getContextMenuItems: PropTypes.func,
        onContextMenuClick: PropTypes.func,
        focusSearchInput: PropTypes.func,
        clearSearchInput: PropTypes.func,

        onItemSelect: PropTypes.func,

        getPlaceParameters: PropTypes.func.isRequired,
        inactiveEntryIds: PropTypes.arrayOf(PropTypes.string),
        isMobileNavigation: PropTypes.bool,
        isOnlyCollectionsMode: PropTypes.bool,
        ignoreWorkbookEntries: PropTypes.bool,
        ignoreSharedEntries: PropTypes.bool,
        onChangeLocation: PropTypes.func,

        resolveUsersByIds: PropTypes.func,

        onPermissionError: PropTypes.func,

        renderEmptyStateAction: PropTypes.func,

        showWorkbookFilter: PropTypes.bool,
        initialWorkbookIds: PropTypes.arrayOf(PropTypes.string),
        onWorkbookFilterChange: PropTypes.func,

        showAuthorFilter: PropTypes.bool,
        initialAuthorIds: PropTypes.arrayOf(PropTypes.string),
        onAuthorFilterChange: PropTypes.func,
        showChartTypeFilter: PropTypes.bool,
        initialChartTypes: PropTypes.arrayOf(PropTypes.string),
        onChartTypeFilterChange: PropTypes.func,
        usersByIds: PropTypes.object,
    };
    static defaultProps = {
        mode: MODE_FULL,
        place: PLACE.ROOT,
        setBreadCrumbs: noop,
        onChangeLocation: noop,
        renderEmptyStateAction: noop,
    };
    static getDerivedStateFromProps(nextProps, prevState) {
        const {scope, path, place} = nextProps;
        const needUpdate = !(
            scope === prevState.scope &&
            path === prevState.path &&
            place === prevState.place
        );
        let {searchValue, hasNextPage, page, ownership} = prevState;

        if (needUpdate) {
            searchValue = '';
            hasNextPage = false;
            page = null;
        }
        if (scope !== prevState.scope && scope !== MAP_PLACE_TO_SCOPE[PLACE.FAVORITES]) {
            ownership = OWNERSHIP.ONLY_MINE;
        }

        return {
            scope,
            path,
            place,
            needUpdate,
            searchValue,
            hasNextPage,
            page,
            ownership,
        };
    }
    constructor(props) {
        super(props);
        const settings = new NavigationSettings();
        const createdBy = settings.getCreatedBy();

        const initialAuthorIds = props.initialAuthorIds || [];
        const initialOwnership =
            initialAuthorIds.length > 0
                ? OWNERSHIP.ALL
                : createdBy
                  ? OWNERSHIP.ONLY_MINE
                  : OWNERSHIP.ALL;

        this.state = {
            settings,
            entries: [],
            filteredEntries: [],
            orderBy: settings.getOrderBy(),
            ownership: initialOwnership,
            currentEntryContextButton: React.createRef(),
            breadCrumbs: [],
            isEmptyFolder: false,
            selectedWorkbookIds: props.initialWorkbookIds || [],
            workbooks: [],
            workbooksLoading: false,
            selectedAuthorIds: initialAuthorIds,
            authors: [],
            authorsLoading: false,
            selectedChartTypes: props.initialChartTypes || [],
        };
        this.debounceGetListDirectory = debounce(this.debounceGetListDirectory, 300);
        this.showHidden = Boolean(Utils.restore('dlShowHiddenEntries'));
    }
    componentDidMount() {
        this._isMounted = true;
        this.getListDirectory();
        if (this.props.showWorkbookFilter) {
            this.loadWorkbooks();
        }
        if (this.props.showAuthorFilter) {
            this.loadAuthors();
        }
    }
    componentDidUpdate(prevProps) {
        if (this.state.needUpdate) {
            if (this.props.clearSearchInput) {
                this.props.clearSearchInput();
            }

            this.getListDirectory();
        }

        if (
            this.props.showAuthorFilter &&
            prevProps.usersByIds !== this.props.usersByIds &&
            this.state.entries.length > 0
        ) {
            const resolvedOptions = buildAuthorOptionsFromEntries(
                this.state.entries,
                this.props.usersByIds,
            );
            if (resolvedOptions.length > 0) {
                this.setState((prevState) => ({
                    authors: mergeAuthorOptions(prevState.authors, resolvedOptions),
                }));
            }
        }
    }
    componentWillUnmount() {
        this._isMounted = false;
    }
    refSearchInput = React.createRef();
    async loadWorkbooks() {
        this.setState({workbooksLoading: true});
        try {
            const loaded = await fetchAccessibleWorkbooks();
            if (this._isMounted) {
                this.setState((prevState) => {
                    const workbooks = this.mergeWorkbooks(prevState.workbooks, loaded);
                    const titleById = new Map(workbooks.map((wb) => [wb.workbookId, wb.title]));
                    const entries = prevState.entries.map((entry) =>
                        entry.workbookId && !entry.workbookTitle && titleById.has(entry.workbookId)
                            ? {...entry, workbookTitle: titleById.get(entry.workbookId)}
                            : entry,
                    );
                    const filteredEntries = this.getFilteredEntries(entries);

                    return {
                        workbooks,
                        entries,
                        filteredEntries,
                        workbooksLoading: false,
                    };
                });
            }
        } catch (error) {
            logger.logError('NavigationEntries: loadWorkbooks failed', error);
            if (this._isMounted) {
                this.setState({workbooksLoading: false});
            }
        }
    }
    async loadAuthors() {
        this.setState({authorsLoading: true});
        try {
            const loaded = await fetchAccessibleAuthors();
            if (this._isMounted) {
                this.setState((prevState) => ({
                    authors: mergeAuthorOptions(prevState.authors, loaded),
                    authorsLoading: false,
                }));
            }
        } catch (error) {
            logger.logError('NavigationEntries: loadAuthors failed', error);
            if (this._isMounted) {
                this.setState({authorsLoading: false});
            }
        }
    }
    mergeWorkbooks(existing = [], incoming = []) {
        const byId = new Map();
        existing.forEach((wb) => {
            if (wb?.workbookId) {
                byId.set(wb.workbookId, wb);
            }
        });
        incoming.forEach((wb) => {
            if (wb?.workbookId) {
                const prev = byId.get(wb.workbookId);
                byId.set(wb.workbookId, {
                    workbookId: wb.workbookId,
                    title: wb.title || prev?.title || wb.workbookId,
                    collectionPath: wb.collectionPath || prev?.collectionPath,
                });
            }
        });
        return Array.from(byId.values()).sort((a, bItem) => a.title.localeCompare(bItem.title));
    }
    getWorkbookTitle(workbookId) {
        const found = this.state.workbooks.find((wb) => wb.workbookId === workbookId);
        return found?.title || null;
    }
    sortEntriesByOrder(entries, orderBy) {
        if (!orderBy) {
            return entries;
        }
        const direction = orderBy.direction === ORDER_DIRECTION.ASC ? 1 : -1;
        return [...entries].sort((a, bItem) => {
            if (orderBy.field === ORDER_FIELD.NAME) {
                return (a.name || '').localeCompare(bItem.name || '') * direction;
            }
            const aTime = new Date(a.createdAt || 0).getTime();
            const bTime = new Date(bItem.createdAt || 0).getTime();
            return (aTime - bTime) * direction;
        });
    }
    async fetchAllEntriesForWorkbook({workbookId, targetScope, orderBy, searchValue, onlyMy}) {
        const collected = [];
        let page = 0;
        let hasMore = false;
        const maxPages = 5;

        do {
            const response = await getSdk().sdk.us.getWorkbookEntries({
                workbookId,
                scope: targetScope,
                includePermissionsInfo: true,
                page,
                pageSize: 200,
                onlyMy,
                orderBy,
                filters: searchValue ? {name: searchValue} : undefined,
            });
            const workbookTitle = this.getWorkbookTitle(workbookId);
            const mapped = (response.entries || []).map((entry) => ({
                ...entry,
                name: entry.name || getEntryNameByKey({key: entry.key || entry.displayKey || ''}),
                workbookTitle: entry.workbookTitle || workbookTitle,
            }));
            collected.push(...mapped);
            hasMore = Boolean(response.nextPageToken);
            page += 1;
        } while (hasMore && page < maxPages);

        return collected;
    }
    async requestFilteredFavorites({
        selectedWorkbookIds,
        selectedAuthorTokens,
        orderBy,
        searchValue,
        pageSize,
    }) {
        const selectedWorkbookSet =
            selectedWorkbookIds.length > 0 ? new Set(selectedWorkbookIds) : null;
        const selectedAuthorSet =
            selectedAuthorTokens.length > 0 ? new Set(selectedAuthorTokens) : null;
        const collected = [];
        let page = 0;
        let hasNextPage = false;
        const maxPages = 10;

        do {
            const response = await getSdk().sdk.mix.getNavigationList({
                place: PLACE.FAVORITES,
                path: normalizeDestination(this.props.path || ''),
                orderBy,
                pageSize,
                page,
                filters: {
                    name: searchValue,
                },
                ignoreWorkbookEntries: this.props.ignoreWorkbookEntries,
            });
            const matched = (response.entries || []).filter((entry) => {
                const matchesWorkbook =
                    !selectedWorkbookSet ||
                    (entry.workbookId && selectedWorkbookSet.has(entry.workbookId));
                const matchesAuthor =
                    !selectedAuthorSet ||
                    (entry.createdBy && selectedAuthorSet.has(entry.createdBy));
                return matchesWorkbook && matchesAuthor;
            });
            collected.push(...matched);
            hasNextPage = Boolean(response.hasNextPage);
            page += 1;
        } while (hasNextPage && page < maxPages);

        return {
            breadCrumbs: [],
            hasNextPage: false,
            entries: collected,
        };
    }
    getFilteredEntries(entries = [], selectedChartTypes = this.state?.selectedChartTypes || []) {
        return entries.filter((entry) => {
            const hideSharedEntry = entry.collectionId && this.props.ignoreSharedEntries;
            const showEntry = !hideSharedEntry && (!entry.hidden || this.showHidden);
            const matchesChartType =
                !this.props.showChartTypeFilter ||
                matchesChartTypeFilter(entry.type, selectedChartTypes);

            return this.props.isMobileNavigation
                ? showEntry && matchesChartType && MOBILE_PLACES.includes(entry.scope)
                : showEntry && matchesChartType;
        });
    }
    refresh = () => {
        this.setState(
            {
                searchValue: '',
                hasNextPage: false,
                page: null,
            },
            () => {
                this.getListDirectory();
            },
        );
    };
    onLoadMore = () => {
        this.getListDirectory();
    };
    changeFavorite(entryId, isFavorite) {
        const {entries: stateEntries} = this.state;
        const entryIndex = stateEntries.findIndex((entry) => entry.entryId === entryId);
        if (entryIndex !== -1) {
            const entries = [
                ...stateEntries.slice(0, entryIndex),
                {...stateEntries[entryIndex], isFavorite},
                ...stateEntries.slice(entryIndex + 1),
            ];
            const filteredEntries = this.getFilteredEntries(entries);
            this.setState({entries, filteredEntries});
        }
    }
    async requestFilteredWorkbookEntries({
        selectedWorkbookIds,
        selectedAuthorTokens,
        targetScope,
        page,
        pageSize,
        onlyMy,
        orderBy,
        searchValue,
    }) {
        const hasAuthorFilter = selectedAuthorTokens.length > 0;
        const selectedAuthorSet = hasAuthorFilter ? new Set(selectedAuthorTokens) : null;

        if (selectedWorkbookIds.length === 1 && !hasAuthorFilter) {
            const workbookId = selectedWorkbookIds[0];
            const response = await getSdk().sdk.us.getWorkbookEntries(
                {
                    workbookId,
                    scope: targetScope,
                    includePermissionsInfo: true,
                    page,
                    pageSize,
                    onlyMy,
                    orderBy,
                    filters: searchValue ? {name: searchValue} : undefined,
                },
                {concurrentId: 'getNavigationList'},
            );
            const workbookTitle = this.getWorkbookTitle(workbookId);
            const entries = (response.entries || []).map((entry) => ({
                ...entry,
                name: entry.name || getEntryNameByKey({key: entry.key || entry.displayKey || ''}),
                workbookTitle: entry.workbookTitle || workbookTitle,
            }));
            return {
                breadCrumbs: [],
                hasNextPage: Boolean(response.nextPageToken),
                entries,
            };
        }

        const batches = await Promise.all(
            selectedWorkbookIds.map((workbookId) =>
                this.fetchAllEntriesForWorkbook({
                    workbookId,
                    targetScope,
                    orderBy,
                    searchValue,
                    onlyMy: hasAuthorFilter ? false : onlyMy,
                }),
            ),
        );
        const uniqueById = new Map();
        batches.flat().forEach((entry) => {
            if (!selectedAuthorSet || (entry.createdBy && selectedAuthorSet.has(entry.createdBy))) {
                uniqueById.set(entry.entryId, entry);
            }
        });
        return {
            breadCrumbs: [],
            hasNextPage: false,
            entries: this.sortEntriesByOrder(Array.from(uniqueById.values()), orderBy),
        };
    }
    async requestList({isSearch}) {
        const {scope, path = '', place, getPlaceParameters, ignoreWorkbookEntries} = this.props;
        const {
            page: currentPage,
            searchValue,
            orderBy,
            selectedWorkbookIds,
            selectedAuthorIds,
            authors,
        } = this.state;
        const placeParameters = getPlaceParameters(place);
        const pageSize = placeParameters.pageSize || 100;

        let page = currentPage === null ? 0 : currentPage + 1;
        if (isSearch) {
            page = 0;
        }
        this.setState({page});

        const selectedAuthorTokens =
            selectedAuthorIds.length > 0
                ? resolveSelectedAuthorTokens(selectedAuthorIds, authors)
                : [];

        if (
            place === PLACE.FAVORITES &&
            (selectedWorkbookIds.length > 0 || selectedAuthorTokens.length > 0)
        ) {
            return this.requestFilteredFavorites({
                selectedWorkbookIds,
                selectedAuthorTokens,
                orderBy,
                searchValue,
                pageSize,
            });
        }

        if (selectedWorkbookIds.length > 0 && place !== PLACE.ROOT) {
            return this.requestFilteredWorkbookEntries({
                selectedWorkbookIds,
                selectedAuthorTokens,
                targetScope: scope || MAP_PLACE_TO_SCOPE[place],
                page,
                pageSize,
                onlyMy: this.state.ownership === OWNERSHIP.ONLY_MINE,
                orderBy,
                searchValue,
            });
        }

        let createdByFilter;
        if (place !== PLACE.ROOT) {
            if (selectedAuthorTokens.length > 0) {
                createdByFilter = selectedAuthorTokens;
            } else if (this.state.ownership === OWNERSHIP.ONLY_MINE) {
                createdByFilter = [DL.USER_LOGIN, makeUserId(DL.USER_ID)];
            }
        }

        return getSdk().sdk.mix.getNavigationList(
            {
                place,
                scope,
                path: normalizeDestination(path),
                orderBy,
                createdBy: createdByFilter,
                pageSize,
                page,
                filters: {
                    name: searchValue,
                },
                ignoreWorkbookEntries,
            },
            {concurrentId: 'getNavigationList'},
        );
    }

    handlePermissionDenied = () => {};

    async getListDirectory({isSearch, ignoreEmpty, isPermissionRetry} = {}) {
        const {path, place, setBreadCrumbs, onPermissionError} = this.props;
        const {isEmptyFolder, searchValue} = this.state;

        if (ignoreEmpty && isEmptyFolder) {
            return;
        }

        this.setState({
            error: null,
            loading: true,
            hasNextPage: isSearch ? false : this.state.hasNextPage,
        });

        try {
            const {
                hasNextPage,
                entries: requestEntries,
                breadCrumbs,
            } = await this.requestList({
                isSearch,
            });
            if (requestEntries.length) {
                const ids = filterUsersIds(requestEntries.map((entry) => entry.createdBy));
                this.props.resolveUsersByIds(ids);
            }
            if (hasNextPage && requestEntries.length === 0) {
                this.getListDirectory();
                return;
            }
            if (!isSearch) {
                setBreadCrumbs(breadCrumbs);
            }
            const entries =
                this.state.hasNextPage && !isSearch
                    ? [...this.state.entries, ...requestEntries]
                    : requestEntries;
            const filteredEntries = this.getFilteredEntries(entries);
            const entryWorkbooks = requestEntries
                .filter((entry) => entry.workbookId && entry.workbookTitle)
                .map((entry) => ({
                    workbookId: entry.workbookId,
                    title: entry.workbookTitle,
                }));
            const entryAuthors = this.props.showAuthorFilter
                ? buildAuthorOptionsFromEntries(requestEntries, this.props.usersByIds)
                : [];
            if (path === this.props.path && place === this.props.place && this._isMounted) {
                const hasActiveFilter =
                    Boolean(searchValue) ||
                    this.state.selectedWorkbookIds.length > 0 ||
                    this.state.selectedAuthorIds.length > 0 ||
                    this.state.selectedChartTypes.length > 0;
                this.setState((prevState) => ({
                    loading: false,
                    entries,
                    filteredEntries,
                    hasNextPage,
                    breadCrumbs,
                    workbooks:
                        entryWorkbooks.length > 0
                            ? this.mergeWorkbooks(prevState.workbooks, entryWorkbooks)
                            : prevState.workbooks,
                    authors:
                        entryAuthors.length > 0
                            ? mergeAuthorOptions(prevState.authors, entryAuthors)
                            : prevState.authors,
                    isEmptyFolder: hasActiveFilter ? isEmptyFolder : filteredEntries.length === 0,
                }));
            }
            if (this.refSearchInput.current) {
                this.refSearchInput.current.focus();
            }
            if (this.props.focusSearchInput) {
                this.props.focusSearchInput();
            }
        } catch (error) {
            if (getSdk().sdk.isCancel(error)) {
                return;
            }
            if (error.status === 403 && !isPermissionRetry) {
                onPermissionError?.();
                this.setState({page: null});
                this.getListDirectory({isPermissionRetry: true});
                return;
            }
            logger.logError('NavigationEntries: getListDirectory failed', error);

            if (this._isMounted) {
                this.setState({
                    loading: false,
                    error,
                    breadCrumbs: this.cutBreadCrubms(path, place),
                });
            }
        }
    }
    cutBreadCrubms(path, place) {
        const {breadCrumbs} = this.state;
        if (place !== PLACE.ROOT) {
            return breadCrumbs;
        }
        const normalizedPath = normalizeDestination(path).toLowerCase();
        const index = breadCrumbs.findIndex(
            (breadCrumb) => breadCrumb.path.toLowerCase() === normalizedPath,
        );
        if (index === -1) {
            return breadCrumbs;
        } else {
            const result = breadCrumbs.slice(0, index + 1);
            this.props.setBreadCrumbs(result);
            return result;
        }
    }

    onChangeFavorite = async (entry) => {
        const {path} = this.props;
        const {entryId, isFavorite} = entry;
        this.changeFavorite(entryId, !isFavorite);
        try {
            if (isFavorite) {
                await getSdk().sdk.us.deleteFavorite({entryId});
            } else {
                await getSdk().sdk.us.addFavorite({entryId});
            }
            if (this.props.onChangeFavorite) {
                this.props.onChangeFavorite({entryId, isFavorite: !isFavorite});
            }
        } catch (error) {
            logger.logError('NavigationEntries: onChangeFavorite failed', error);
            if (path === this.props.path) {
                // rollback
                this.changeFavorite(entryId, isFavorite);

                this.props.showToast({
                    title: isFavorite
                        ? i18n('toast_failed-remove-favorite')
                        : i18n('toast_failed-add-favorite'),
                    name: 'ChangeFavoriteFailed',
                    error,
                });
            }
        }
    };
    onEntryContextClick = ({entry, buttonRef}) => {
        const isVisible =
            !this.state.currentEntryContext ||
            this.state.currentEntryContext.entryId !== entry.entryId;

        this.setState({
            currentEntryContextButton: isVisible ? buttonRef : React.createRef(),
            currentEntryContext: isVisible ? entry : null,
        });
    };
    closeEntryContextMenu = () => {
        this.setState({
            currentEntryContextButton: React.createRef(),
            currentEntryContext: null,
        });
    };
    debounceGetListDirectory({isSearch, ignoreEmpty}) {
        this.getListDirectory({isSearch, ignoreEmpty});
    }
    onChangeFilter = (searchValue) => {
        const filteredEntries = this.getFilteredEntries(this.state.entries);
        this.setState(
            {
                searchValue,
                filteredEntries,
            },
            () => {
                this.debounceGetListDirectory({isSearch: true, ignoreEmpty: true});
            },
        );
    };
    onChangeOrderBy = (orderBy) => {
        if (this.props.mode !== MODE_MINIMAL) {
            this.state.settings.setOrderBy(orderBy.field, orderBy.direction);
        }
        this.setState(
            {
                orderBy,
                hasNextPage: false,
                page: null,
            },
            () => {
                this.getListDirectory({ignoreEmpty: true});
            },
        );
    };
    onChangeOwnership = (ownership) => {
        if (this.props.mode !== MODE_MINIMAL) {
            this.state.settings.setCreatedBy(
                ownership === OWNERSHIP.ONLY_MINE ? DL.USER_LOGIN : '',
            );
        }

        const shouldClearAuthorFilter =
            ownership === OWNERSHIP.ONLY_MINE && this.state.selectedAuthorIds.length > 0;
        if (shouldClearAuthorFilter) {
            this.props.onAuthorFilterChange?.([]);
        }

        this.setState(
            {
                ownership,
                ...(shouldClearAuthorFilter ? {selectedAuthorIds: []} : {}),
                hasNextPage: false,
                page: null,
            },
            () => {
                this.getListDirectory();
            },
        );
    };
    onChangeWorkbookFilter = (selectedWorkbookIds) => {
        this.props.onWorkbookFilterChange?.(selectedWorkbookIds);
        this.setState(
            {
                selectedWorkbookIds,
                hasNextPage: false,
                page: null,
            },
            () => {
                this.getListDirectory();
            },
        );
    };
    onChangeAuthorFilter = (selectedAuthorIds) => {
        this.props.onAuthorFilterChange?.(selectedAuthorIds);
        const shouldResetOwnership =
            selectedAuthorIds.length > 0 && this.state.ownership === OWNERSHIP.ONLY_MINE;
        if (shouldResetOwnership && this.props.mode !== MODE_MINIMAL) {
            this.state.settings.setCreatedBy('');
        }
        this.setState(
            {
                selectedAuthorIds,
                ...(shouldResetOwnership ? {ownership: OWNERSHIP.ALL} : {}),
                hasNextPage: false,
                page: null,
            },
            () => {
                this.getListDirectory();
            },
        );
    };

    onChangeChartTypeFilter = (selectedChartTypes) => {
        this.props.onChartTypeFilterChange?.(selectedChartTypes);
        const filteredEntries = this.getFilteredEntries(this.state.entries, selectedChartTypes);
        this.setState({
            selectedChartTypes,
            filteredEntries,
        });
    };

    onAllDashboardsFilterClick = () => {
        this.setState(
            {
                ownership: OWNERSHIP.ALL,
                hasNextPage: false,
                page: null,
            },
            () => {
                if (this.props.place !== PLACE.DASHBOARDS) {
                    this.props.onPlaceChange(PLACE.DASHBOARDS);
                } else {
                    this.getListDirectory();
                }
            },
        );
    };
    onOnlyMineDashboardsFilterClick = () => {
        this.setState(
            {
                ownership: OWNERSHIP.ONLY_MINE,
                hasNextPage: false,
                page: null,
            },
            () => {
                if (this.props.place !== PLACE.DASHBOARDS) {
                    this.props.onPlaceChange(PLACE.DASHBOARDS);
                } else {
                    this.getListDirectory();
                }
            },
        );
    };
    onFavoritesDashboardsFilterClick = () => {
        this.setState(
            {
                ownership: OWNERSHIP.ALL,
                hasNextPage: false,
                page: null,
            },
            () => {
                this.props.onPlaceChange(PLACE.FAVORITES);
            },
        );
    };

    onSelectTab = (tabId) => {
        const {onPlaceChange, defaultPlace} = this.props;
        this.setState(
            {
                ownership: tabId,
                hasNextPage: false,
                page: null,
            },
            () => {
                if (tabId === OWNERSHIP.ONLY_MINE || tabId === OWNERSHIP.ALL) {
                    onPlaceChange(defaultPlace || PLACE.DASHBOARDS);
                    this.getListDirectory();
                    return;
                }
                onPlaceChange(PLACE.FAVORITES);
            },
        );
    };

    renderEntriesHeader() {
        const {mode} = this.props;
        const {place} = this.state;
        const {filters} = this.props.getPlaceParameters(place);
        const isMinimalMode = mode === MODE_MINIMAL;

        if (!filters && isMinimalMode) {
            return null;
        }

        return (
            <div className={b('entries-header')}>
                <div className={b('search')}>
                    <SearchInput
                        ref={this.refSearchInput}
                        text={this.state.searchValue}
                        placeholder={i18n('label_placeholder-filter-by-name')}
                        onChange={this.onChangeFilter}
                    />
                </div>
                {filters && (
                    <div className={b('filters')}>
                        {this.props.showChartTypeFilter && (
                            <div className={b('filters-item')}>
                                <ChartTypeFilterSelect
                                    value={this.state.selectedChartTypes}
                                    onChange={this.onChangeChartTypeFilter}
                                />
                            </div>
                        )}
                        {this.props.showWorkbookFilter && (
                            <div className={b('filters-item')}>
                                <WorkbookFilterSelect
                                    value={this.state.selectedWorkbookIds}
                                    options={this.state.workbooks}
                                    loading={this.state.workbooksLoading}
                                    onChange={this.onChangeWorkbookFilter}
                                />
                            </div>
                        )}
                        {this.props.showAuthorFilter && (
                            <div className={b('filters-item')}>
                                <AuthorFilterSelect
                                    value={this.state.selectedAuthorIds}
                                    options={this.state.authors}
                                    loading={this.state.authorsLoading}
                                    onChange={this.onChangeAuthorFilter}
                                />
                            </div>
                        )}
                        {filters.order && (
                            <div className={b('filters-item')}>
                                <OrderSelect
                                    orderBy={this.state.orderBy}
                                    onChange={this.onChangeOrderBy}
                                />
                            </div>
                        )}
                        {filters.ownership && (
                            <div className={b('filters-item')}>
                                <RadioButton
                                    value={this.state.ownership}
                                    onUpdate={this.onChangeOwnership}
                                    options={[
                                        {
                                            value: OWNERSHIP.ALL,
                                            content: i18n('value_ownership-all'),
                                        },
                                        {
                                            value: OWNERSHIP.ONLY_MINE,
                                            content: i18n('value_ownership-only-mine'),
                                        },
                                    ]}
                                />
                            </div>
                        )}
                    </div>
                )}
                <div className={b('custom')}>{this.props.children}</div>
            </div>
        );
    }
    renderFiltersForMobileNavigationPage() {
        const {ownership} = this.state;

        return (
            <div>
                <div className={b('mobile-filters', {mobile: DL.IS_MOBILE})}>
                    <Tabs
                        items={mobileTabsItems}
                        activeTab={ownership}
                        size={MOBILE_SIZE.TABS}
                        onSelectTab={this.onSelectTab}
                    />
                </div>
            </div>
        );
    }
    renderLoader() {
        return (
            <div className={b('spinner')}>
                <Loader size="l" />
            </div>
        );
    }
    renderContextMenu() {
        return (
            this.state.currentEntryContextButton.current && (
                <EntryContextMenuBase
                    visible={true}
                    entry={this.state.currentEntryContext}
                    anchorElement={this.state.currentEntryContextButton.current}
                    items={this.props.getContextMenuItems({
                        entry: this.state.currentEntryContext,
                        place: this.state.place,
                    })}
                    onMenuClick={this.props.onContextMenuClick}
                    onClose={this.closeEntryContextMenu}
                />
            )
        );
    }
    renderView() {
        const {place, entries, filteredEntries, currentEntryContext, isEmptyFolder} = this.state;
        const {mode} = this.props;

        const filteredEntriesEmpty = filteredEntries.length === 0;
        const entriesEmpty = entries.length === 0;
        const showEmpty = filteredEntriesEmpty || entriesEmpty;

        if (showEmpty) {
            return (
                <EmptyState
                    className={b('empty-entries')}
                    mode={mode}
                    isEmptyFolder={isEmptyFolder}
                    place={place}
                    renderAction={this.props.renderEmptyStateAction}
                />
            );
        }

        const {displayParentFolder} = this.props.getPlaceParameters(place);

        return (
            <div className={b('table-view')}>
                <TableView
                    linkWrapper={this.props.linkWrapper}
                    mode={this.props.mode}
                    place={place}
                    clickableScope={this.props.clickableScope}
                    inactiveEntryKeys={this.props.inactiveEntryKeys}
                    currentPageEntry={this.props.currentPageEntry}
                    checkEntryActivity={this.props.checkEntryActivity}
                    entries={filteredEntries}
                    inactiveEntryIds={this.props.inactiveEntryIds}
                    currentEntryContext={currentEntryContext}
                    displayParentFolder={!this.props.isMobileNavigation && displayParentFolder}
                    onChangeFavorite={this.onChangeFavorite}
                    onEntryContextClick={this.onEntryContextClick}
                    onCloseEntryContextMenu={this.closeEntryContextMenu}
                    onEntryParentClick={this.props.onEntryParentClick}
                    onEntryClick={this.props.onEntryClick}
                    loading={this.state.loading}
                    hasNextPage={this.state.hasNextPage}
                    onLoadMore={this.onLoadMore}
                    isMobileNavigation={this.props.isMobileNavigation}
                    isOnlyCollectionsMode={this.props.isOnlyCollectionsMode}
                    refreshNavigation={this.refresh}
                    onChangeLocation={this.props.onChangeLocation}
                    onMenuClick={this.props.onContextMenuClick}
                    onItemSelect={this.props.onItemSelect}
                />
            </div>
        );
    }
    render() {
        const {isMobileNavigation} = this.props;
        const {loading, error, hasNextPage} = this.state;

        if (error) {
            return <ErrorView error={error} onRetryClick={this.refresh} />;
        }

        return (
            <div className={b('entries')}>
                {isMobileNavigation
                    ? this.renderFiltersForMobileNavigationPage()
                    : this.renderEntriesHeader()}
                <div className={b('view')}>
                    {loading && !hasNextPage ? this.renderLoader() : this.renderView()}
                    {this.renderContextMenu()}
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    usersByIds: state?.auth?.usersByIds?.users ? selectUsersByIds(state) : {},
});

const mapDispatchToProps = {
    // need to be wrapped in additional function because the registry function does not have time to register
    resolveUsersByIds: (ids) => getResolveUsersByIdsAction()(ids),
    showToast,
};

export default connect(mapStateToProps, mapDispatchToProps, null, {forwardRef: true})(
    NavigationEntries,
);
