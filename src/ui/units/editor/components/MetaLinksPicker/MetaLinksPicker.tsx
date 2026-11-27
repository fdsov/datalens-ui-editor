import React from 'react';

import {Link as LinkIcon, Magnifier, Plus} from '@gravity-ui/icons';
import {
    Button,
    Dialog,
    Icon,
    Loader,
    SegmentedRadioGroup,
    TextInput,
    Tooltip,
} from '@gravity-ui/uikit';
import block from 'bem-cn-lite';
import debounce from 'lodash/debounce';
import {useDispatch, useSelector} from 'react-redux';
import {EntryIcon} from 'ui/components/EntryIcon/EntryIcon';
import {PLACE} from 'ui/components/Navigation/constants';
import {getSdk} from 'ui/libs/schematic-sdk';

import {changeEditorCode} from '../../store/actions';

import './MetaLinksPicker.scss';

const b = block('editor-meta-links-picker');

const TRANSLIT_MAP: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
};

export function parseMetaLinks(metaValue?: string | null): Record<string, string> {
    if (!metaValue || typeof metaValue !== 'string') {
        return {};
    }
    try {
        const parsed = JSON.parse(metaValue);
        if (
            parsed &&
            typeof parsed === 'object' &&
            parsed.links &&
            typeof parsed.links === 'object'
        ) {
            const links: Record<string, string> = {};
            Object.entries(parsed.links).forEach(([key, val]) => {
                if (typeof val === 'string') {
                    links[key] = val;
                }
            });
            return links;
        }
    } catch {
        // Ignore invalid JSON while user is typing
    }
    return {};
}

export function upsertMetaLink(
    metaValue: string | undefined,
    alias: string,
    entryId: string,
): string {
    let parsed: Record<string, unknown> = {};
    if (metaValue && metaValue.trim()) {
        try {
            const candidate = JSON.parse(metaValue);
            if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
                parsed = candidate as Record<string, unknown>;
            }
        } catch {
            parsed = {};
        }
    }

    const existingLinks =
        parsed.links && typeof parsed.links === 'object' && !Array.isArray(parsed.links)
            ? {...(parsed.links as Record<string, string>)}
            : {};

    existingLinks[alias.trim()] = entryId.trim();

    return JSON.stringify(
        {
            ...parsed,
            links: existingLinks,
        },
        null,
        4,
    );
}

export function suggestAliasFromName(name: string): string {
    const transliterated = name
        .toLowerCase()
        .split('')
        .map((ch) => (ch in TRANSLIT_MAP ? TRANSLIT_MAP[ch] : ch))
        .join('');

    const normalized = transliterated
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toUpperCase();

    return normalized || 'SOURCE';
}

type PickerScope = typeof PLACE.CONNECTIONS | typeof PLACE.DATASETS | typeof PLACE.WIDGETS;

type PickerEntry = {
    entryId: string;
    name: string;
    scope: string;
    type: string;
    workbookTitle?: string | null;
};

type RootState = {
    editor?: {
        scriptsValues?: Record<string, string>;
    };
};

export const MetaLinksPicker: React.FC<{className?: string}> = ({className}) => {
    const dispatch = useDispatch();
    const metaValue = useSelector((state: RootState) => state.editor?.scriptsValues?.meta || '');

    const [open, setOpen] = React.useState(false);
    const [scope, setScope] = React.useState<PickerScope>(PLACE.CONNECTIONS);
    const [search, setSearch] = React.useState('');
    const [entries, setEntries] = React.useState<PickerEntry[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [selectedEntry, setSelectedEntry] = React.useState<PickerEntry | null>(null);
    const [alias, setAlias] = React.useState('');
    const reqSeqRef = React.useRef(0);

    const loadEntries = React.useMemo(
        () =>
            debounce(async (targetScope: PickerScope, searchQuery: string) => {
                const seq = ++reqSeqRef.current;
                setLoading(true);
                try {
                    const response = await getSdk().sdk.mix.getNavigationList({
                        place: targetScope,
                        path: '',
                        page: 0,
                        pageSize: 30,
                        filters: searchQuery.trim() ? {name: searchQuery.trim()} : undefined,
                        ignoreWorkbookEntries: false,
                    });
                    if (seq === reqSeqRef.current) {
                        setEntries((response.entries || []) as PickerEntry[]);
                        setLoading(false);
                    }
                } catch {
                    if (seq === reqSeqRef.current) {
                        setEntries([]);
                        setLoading(false);
                    }
                }
            }, 180),
        [],
    );

    React.useEffect(() => {
        if (!open) {
            return;
        }
        loadEntries(scope, search);
    }, [open, scope, search, loadEntries]);

    React.useEffect(() => {
        return () => {
            loadEntries.cancel();
        };
    }, [loadEntries]);

    const handleOpen = () => {
        setSelectedEntry(null);
        setAlias('');
        setSearch('');
        setOpen(true);
    };

    const handlePickEntry = (entry: PickerEntry) => {
        setSelectedEntry(entry);
        setAlias(suggestAliasFromName(entry.name || entry.entryId));
    };

    const handleApply = () => {
        if (!selectedEntry || !alias.trim()) {
            return;
        }
        const nextMeta = upsertMetaLink(metaValue, alias, selectedEntry.entryId);
        dispatch(changeEditorCode({scriptId: 'meta', value: nextMeta}));
        setOpen(false);
    };

    return (
        <React.Fragment>
            <Tooltip content="Добавить подключение или датасет в Meta.links">
                <Button
                    className={b('trigger', className)}
                    view="flat-secondary"
                    size="s"
                    onClick={handleOpen}
                    qa="editor-meta-add-link-btn"
                >
                    <Icon data={Plus} size={14} />
                    <span>Связь</span>
                </Button>
            </Tooltip>

            <Dialog
                open={open}
                onClose={() => setOpen(false)}
                className={b('dialog')}
                qa="editor-meta-links-dialog"
            >
                <Dialog.Header caption="Добавить связь в Meta.links" />
                <Dialog.Body>
                    <div className={b('controls')}>
                        <SegmentedRadioGroup
                            value={scope}
                            onUpdate={(val) => setScope(val as PickerScope)}
                            options={[
                                {value: PLACE.CONNECTIONS, content: 'Подключения'},
                                {value: PLACE.DATASETS, content: 'Датасеты'},
                                {value: PLACE.WIDGETS, content: 'Чарты'},
                            ]}
                        />
                        <TextInput
                            value={search}
                            onUpdate={setSearch}
                            placeholder="Поиск по названию..."
                            startContent={<Icon data={Magnifier} size={14} />}
                            hasClear
                            qa="editor-meta-links-search"
                        />
                    </div>

                    <div className={b('list')}>
                        {loading ? (
                            <div className={b('state')}>
                                <Loader size="m" />
                            </div>
                        ) : entries.length === 0 ? (
                            <div className={b('state')}>Ничего не найдено</div>
                        ) : (
                            entries.map((entry) => {
                                const isSelected = selectedEntry?.entryId === entry.entryId;
                                return (
                                    <button
                                        key={entry.entryId}
                                        type="button"
                                        className={b('row', {selected: isSelected})}
                                        onClick={() => handlePickEntry(entry)}
                                    >
                                        <EntryIcon entry={entry} size={18} entityIconSize="s" />
                                        <span className={b('row-info')}>
                                            <span className={b('row-name')}>
                                                {entry.name || entry.entryId}
                                            </span>
                                            <span className={b('row-meta')}>
                                                {entry.workbookTitle
                                                    ? `${entry.workbookTitle} · ${entry.entryId}`
                                                    : entry.entryId}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    <div className={b('alias-row')}>
                        <div className={b('alias-label')}>
                            <Icon data={LinkIcon} size={14} />
                            <span>Алиас для Editor.getId(&apos;...&apos;)</span>
                        </div>
                        <TextInput
                            value={alias}
                            onUpdate={setAlias}
                            placeholder="Например: PG или BONUS_DATASET"
                            disabled={!selectedEntry}
                            qa="editor-meta-links-alias"
                        />
                    </div>
                </Dialog.Body>
                <Dialog.Footer
                    onClickButtonCancel={() => setOpen(false)}
                    onClickButtonApply={handleApply}
                    textButtonCancel="Отмена"
                    textButtonApply="Добавить"
                    propsButtonApply={{
                        disabled: !selectedEntry || !alias.trim(),
                    }}
                />
            </Dialog>
        </React.Fragment>
    );
};

export default MetaLinksPicker;
