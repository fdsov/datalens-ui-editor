import React from 'react';

import {Icon, Select} from '@gravity-ui/uikit';
import type {SelectOption} from '@gravity-ui/uikit';
import block from 'bem-cn-lite';
import {I18n} from 'i18n';
import {CollectionItemEntities} from 'shared';
import {getSdk} from 'ui/libs/schematic-sdk';

import workbookIcon from '../../../../assets/icons/collections/workbook.svg';

import './WorkbookFilterSelect.scss';

const b = block('dl-core-navigation-workbook-filter');
const i18n = I18n.keyset('component.navigation.view');

export type WorkbookFilterOption = {
    workbookId: string;
    title: string;
    collectionPath?: string;
};

const MAX_COLLECTION_FETCHES = 100;
const STRUCTURE_PAGE_SIZE = 200;
const CACHE_TTL_MS = 60_000;

let cachedWorkbooks: WorkbookFilterOption[] | null = null;
let cachedAt = 0;

export function resetWorkbookFilterCache() {
    cachedWorkbooks = null;
    cachedAt = 0;
}

async function fetchStructureItemsAllPages(collectionId: string | null) {
    const items = [];
    let page: string | null | undefined;
    let guard = 0;

    do {
        const response = await getSdk().sdk.us.getStructureItems({
            collectionId,
            page: page ?? undefined,
            pageSize: STRUCTURE_PAGE_SIZE,
            orderField: 'title',
            orderDirection: 'asc',
        });
        items.push(...response.items);
        page = response.nextPageToken;
        guard += 1;
    } while (page && guard < 20);

    return items;
}

export async function fetchAccessibleWorkbooks(): Promise<WorkbookFilterOption[]> {
    if (cachedWorkbooks && Date.now() - cachedAt < CACHE_TTL_MS) {
        return cachedWorkbooks;
    }

    const workbooksById = new Map<string, WorkbookFilterOption>();
    const queue: Array<{collectionId: string | null; path: string[]}> = [
        {collectionId: null, path: []},
    ];
    const visitedCollections = new Set<string>();
    let fetches = 0;

    while (queue.length > 0 && fetches < MAX_COLLECTION_FETCHES) {
        const batch = queue.splice(0, 5);
        fetches += batch.length;

        const results = await Promise.all(
            batch.map(async (node) => {
                try {
                    const items = await fetchStructureItemsAllPages(node.collectionId);
                    return {node, items};
                } catch (_err) {
                    return {node, items: []};
                }
            }),
        );

        for (const {node, items} of results) {
            for (const item of items) {
                if (item.entity === CollectionItemEntities.WORKBOOK) {
                    workbooksById.set(item.workbookId, {
                        workbookId: item.workbookId,
                        title: item.title,
                        collectionPath: node.path.length ? node.path.join(' / ') : undefined,
                    });
                } else if (
                    item.entity === CollectionItemEntities.COLLECTION &&
                    !visitedCollections.has(item.collectionId)
                ) {
                    visitedCollections.add(item.collectionId);
                    queue.push({
                        collectionId: item.collectionId,
                        path: [...node.path, item.title],
                    });
                }
            }
        }
    }

    const sorted = Array.from(workbooksById.values()).sort((a, bItem) =>
        a.title.localeCompare(bItem.title),
    );

    cachedWorkbooks = sorted;
    cachedAt = Date.now();
    return sorted;
}

type WorkbookFilterSelectProps = {
    value: string[];
    options: WorkbookFilterOption[];
    loading?: boolean;
    disabled?: boolean;
    onChange: (workbookIds: string[]) => void;
};

export const WorkbookFilterSelect = ({
    value,
    options,
    loading,
    disabled,
    onChange,
}: WorkbookFilterSelectProps) => {
    const selectOptions: SelectOption[] = React.useMemo(
        () =>
            options.map((wb) => ({
                value: wb.workbookId,
                content: wb.title,
                text: wb.collectionPath ? `${wb.title} ${wb.collectionPath}` : wb.title,
                data: wb,
            })),
        [options],
    );

    const renderOption = React.useCallback((option: SelectOption<WorkbookFilterOption>) => {
        const wb = option.data;
        return (
            <div className={b('option')}>
                <Icon className={b('option-icon')} data={workbookIcon} size={14} />
                <div className={b('option-text')}>
                    <span className={b('option-title')}>{wb?.title ?? option.content}</span>
                    {wb?.collectionPath && (
                        <span className={b('option-path')}>{wb.collectionPath}</span>
                    )}
                </div>
            </div>
        );
    }, []);

    return (
        <Select
            className={b()}
            popupClassName={b('popup')}
            qa="navigation-workbook-filter"
            multiple={true}
            filterable={true}
            hasClear={true}
            loading={loading}
            disabled={disabled}
            value={value}
            options={selectOptions}
            renderOption={renderOption}
            getOptionHeight={(option: SelectOption<WorkbookFilterOption>) =>
                option.data?.collectionPath ? 42 : 28
            }
            placeholder={i18n('label_placeholder-workbook-filter')}
            filterPlaceholder={i18n('label_placeholder-workbook-search')}
            onUpdate={onChange}
        />
    );
};

export default WorkbookFilterSelect;
