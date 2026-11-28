import React from 'react';

import {
    ChartColumn,
    CirclesIntersection,
    Database,
    LayoutCells,
    Magnifier,
    Star,
} from '@gravity-ui/icons';
import {Dialog, Icon, Loader, TextInput} from '@gravity-ui/uikit';
import block from 'bem-cn-lite';
import {I18n} from 'i18n';
import debounce from 'lodash/debounce';
import {useHistory} from 'react-router-dom';
import {DL} from 'ui/constants/common';
import navigateHelper from 'ui/libs/navigateHelper';
import {getSdk} from 'ui/libs/schematic-sdk';

import {EntryIcon} from '../EntryIcon/EntryIcon';
import {fetchAccessibleWorkbooks} from '../Navigation/Core/WorkbookFilterSelect/WorkbookFilterSelect';
import type {WorkbookFilterOption} from '../Navigation/Core/WorkbookFilterSelect/WorkbookFilterSelect';
import {PLACE} from '../Navigation/constants';

import workbookIcon from '../../assets/icons/collections/workbook.svg';
import collectionIcon from '../../assets/icons/mono-collection.svg';

import './CommandPalette.scss';

const b = block('dl-command-palette');
const navI18n = I18n.keyset('component.navigation.view');

export const OPEN_COMMAND_PALETTE_EVENT = 'dl:open-command-palette';

export type CommandPaletteItem = {
    id: string;
    title: string;
    subtitle?: string;
    badge: string;
    url: string;
    kind: 'action' | 'workbook' | 'entry';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entry?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon?: any;
};

const QUICK_NAV_ITEMS: CommandPaletteItem[] = [
    {
        id: 'nav-collections',
        title: 'Коллекции и воркбуки',
        badge: 'Раздел',
        url: '/collections',
        kind: 'action',
        icon: collectionIcon,
    },
    {
        id: 'nav-dashboards',
        title: navI18n('switch_dashboards'),
        badge: 'Раздел',
        url: '/dashboards',
        kind: 'action',
        icon: LayoutCells,
    },
    {
        id: 'nav-charts',
        title: navI18n('switch_widgets'),
        badge: 'Раздел',
        url: '/charts',
        kind: 'action',
        icon: ChartColumn,
    },
    {
        id: 'nav-datasets',
        title: navI18n('switch_datasets'),
        badge: 'Раздел',
        url: '/datasets',
        kind: 'action',
        icon: CirclesIntersection,
    },
    {
        id: 'nav-connections',
        title: navI18n('switch_connections'),
        badge: 'Раздел',
        url: '/connections',
        kind: 'action',
        icon: Database,
    },
    {
        id: 'nav-favorites',
        title: navI18n('switch_favorites'),
        badge: 'Раздел',
        url: '/favorites',
        kind: 'action',
        icon: Star,
    },
];

const PLACE_BADGES: Record<string, string> = {
    [PLACE.DASHBOARDS]: 'Дашборд',
    [PLACE.WIDGETS]: 'Чарт',
    [PLACE.DATASETS]: 'Датасет',
    [PLACE.CONNECTIONS]: 'Подключение',
};

function toRelativeSpaUrl(rawUrl: string): string {
    try {
        const parsed = new URL(rawUrl, window.location.origin);
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return rawUrl;
    }
}

export function openCommandPalette() {
    window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
}

export const CommandPalette: React.FC = () => {
    const history = useHistory();
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const [activeIndex, setActiveIndex] = React.useState(0);
    const [workbooks, setWorkbooks] = React.useState<WorkbookFilterOption[]>([]);
    const [entryResults, setEntryResults] = React.useState<CommandPaletteItem[]>([]);
    const [loading, setLoading] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const requestSeqRef = React.useRef(0);

    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                const target = event.target as HTMLElement | null;
                if (target?.closest('.monaco-editor')) {
                    return;
                }
                event.preventDefault();
                setOpen((prev) => !prev);
            }
        };

        const onCustomOpen = () => {
            setOpen(true);
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onCustomOpen);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onCustomOpen);
        };
    }, []);

    React.useEffect(() => {
        if (!open) {
            return;
        }
        setQuery('');
        setEntryResults([]);
        setActiveIndex(0);
        window.requestAnimationFrame(() => {
            inputRef.current?.focus();
        });
        fetchAccessibleWorkbooks()
            .then((list) => setWorkbooks(list))
            .catch(() => {});
    }, [open]);

    const searchEntries = React.useMemo(
        () =>
            debounce(async (searchText: string) => {
                const trimmed = searchText.trim();
                const seq = ++requestSeqRef.current;

                if (!trimmed) {
                    setEntryResults([]);
                    setLoading(false);
                    return;
                }

                setLoading(true);
                const places = [PLACE.DASHBOARDS, PLACE.WIDGETS, PLACE.DATASETS, PLACE.CONNECTIONS];

                try {
                    const responses = await Promise.all(
                        places.map(async (place) => {
                            try {
                                const res = await getSdk().sdk.mix.getNavigationList({
                                    place,
                                    path: '',
                                    page: 0,
                                    pageSize: 6,
                                    filters: {name: trimmed},
                                    ignoreWorkbookEntries: false,
                                });
                                return (res.entries || []).map((entry) => ({
                                    id: `${place}-${entry.entryId}`,
                                    title: entry.name || entry.entryId,
                                    subtitle: entry.workbookTitle || undefined,
                                    badge: PLACE_BADGES[place] || place,
                                    url: toRelativeSpaUrl(
                                        navigateHelper.redirectUrlSwitcher(entry),
                                    ),
                                    kind: 'entry' as const,
                                    entry,
                                }));
                            } catch {
                                return [];
                            }
                        }),
                    );

                    if (seq === requestSeqRef.current) {
                        setEntryResults(responses.flat());
                        setLoading(false);
                    }
                } catch {
                    if (seq === requestSeqRef.current) {
                        setLoading(false);
                    }
                }
            }, 180),
        [],
    );

    React.useEffect(() => {
        return () => {
            searchEntries.cancel();
        };
    }, [searchEntries]);

    const handleQueryUpdate = React.useCallback(
        (nextValue: string) => {
            setQuery(nextValue);
            setActiveIndex(0);
            searchEntries(nextValue);
        },
        [searchEntries],
    );

    const items: CommandPaletteItem[] = React.useMemo(() => {
        const q = query.trim().toLowerCase();

        const matchingActions = q
            ? QUICK_NAV_ITEMS.filter((item) => item.title.toLowerCase().includes(q))
            : QUICK_NAV_ITEMS;

        const matchingWorkbooks: CommandPaletteItem[] = workbooks
            .filter(
                (wb) =>
                    !q ||
                    wb.title.toLowerCase().includes(q) ||
                    (wb.collectionPath && wb.collectionPath.toLowerCase().includes(q)),
            )
            .slice(0, q ? 8 : 6)
            .map((wb) => ({
                id: `wb-${wb.workbookId}`,
                title: wb.title,
                subtitle: wb.collectionPath,
                badge: 'Воркбук',
                url: `/workbooks/${wb.workbookId}`,
                kind: 'workbook',
                icon: workbookIcon,
            }));

        if (q) {
            return [...entryResults, ...matchingWorkbooks, ...matchingActions];
        }

        return [...matchingActions, ...matchingWorkbooks];
    }, [entryResults, query, workbooks]);

    const handleSelect = React.useCallback(
        (item: CommandPaletteItem, openInNewTab = false) => {
            setOpen(false);
            if (openInNewTab) {
                window.open(item.url, '_blank', 'noopener,noreferrer');
                return;
            }
            history.push(item.url);
        },
        [history],
    );

    const handleKeyDown = React.useCallback(
        (event: React.KeyboardEvent) => {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((prev) => (items.length ? (prev + 1) % items.length : 0));
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((prev) =>
                    items.length ? (prev - 1 + items.length) % items.length : 0,
                );
            } else if (event.key === 'Enter' && items[activeIndex]) {
                event.preventDefault();
                handleSelect(items[activeIndex], event.metaKey || event.ctrlKey);
            }
        },
        [activeIndex, handleSelect, items],
    );

    if (DL.IS_MOBILE) {
        return null;
    }

    return (
        <Dialog
            open={open}
            onClose={() => setOpen(false)}
            className={b()}
            hasCloseButton={false}
            qa="command-palette-dialog"
        >
            <div className={b('container')} onKeyDown={handleKeyDown}>
                <div className={b('search-row')}>
                    <Icon data={Magnifier} size={16} className={b('search-icon')} />
                    <TextInput
                        controlRef={inputRef}
                        view="clear"
                        size="l"
                        value={query}
                        onUpdate={handleQueryUpdate}
                        placeholder="Поиск дашбордов, чартов, датасетов, подключений и воркбуков..."
                        qa="command-palette-input"
                    />
                    {loading && <Loader size="s" className={b('loader')} />}
                    <span className={b('kbd')}>ESC</span>
                </div>

                <div className={b('list')} role="listbox">
                    {items.length === 0 ? (
                        <div className={b('empty')}>
                            {loading ? 'Ищем...' : navI18n('label_not-found')}
                        </div>
                    ) : (
                        items.map((item, idx) => (
                            <button
                                key={item.id}
                                type="button"
                                role="option"
                                aria-selected={idx === activeIndex}
                                className={b('item', {active: idx === activeIndex})}
                                onMouseEnter={() => setActiveIndex(idx)}
                                onClick={(e) => handleSelect(item, e.metaKey || e.ctrlKey)}
                            >
                                <span className={b('item-icon')}>
                                    {item.kind === 'entry' && item.entry ? (
                                        <EntryIcon
                                            entry={item.entry}
                                            size={18}
                                            entityIconSize="s"
                                        />
                                    ) : (
                                        item.icon && <Icon data={item.icon} size={16} />
                                    )}
                                </span>
                                <span className={b('item-content')}>
                                    <span className={b('item-title')}>{item.title}</span>
                                    {item.subtitle && (
                                        <span className={b('item-subtitle')}>{item.subtitle}</span>
                                    )}
                                </span>
                                <span className={b('item-badge')}>{item.badge}</span>
                            </button>
                        ))
                    )}
                </div>

                <div className={b('footer')}>
                    <span>↑↓ навигация</span>
                    <span>↵ открыть</span>
                    <span>⌘↵ в новой вкладке</span>
                </div>
            </div>
        </Dialog>
    );
};

export default CommandPalette;
