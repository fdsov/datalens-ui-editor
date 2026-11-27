import React from 'react';

import {Person} from '@gravity-ui/icons';
import {Icon, Select} from '@gravity-ui/uikit';
import type {SelectOption} from '@gravity-ui/uikit';
import block from 'bem-cn-lite';
import {I18n} from 'i18n';
import {getUserId, isUserId, makeUserId} from 'shared';
import {DL} from 'ui/constants/common';
import {getSdk} from 'ui/libs/schematic-sdk';

import './AuthorFilterSelect.scss';

const b = block('dl-core-navigation-author-filter');
const i18n = I18n.keyset('component.navigation.view');

export type AuthorFilterOption = {
    id: string;
    label: string;
    sublabel?: string;
    matchValues: string[];
};

const USERS_PAGE_SIZE = 200;
const MAX_USER_PAGES = 10;
const CACHE_TTL_MS = 60_000;

let cachedAuthors: AuthorFilterOption[] | null = null;
let cachedAt = 0;

export function resetAuthorFilterCache() {
    cachedAuthors = null;
    cachedAt = 0;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
    return Array.from(new Set(values.filter((v): v is string => Boolean(v))));
}

export async function fetchAccessibleAuthors(): Promise<AuthorFilterOption[]> {
    if (cachedAuthors && Date.now() - cachedAt < CACHE_TTL_MS) {
        return cachedAuthors;
    }

    const authors: AuthorFilterOption[] = [];

    if (DL.AUTH_ENABLED) {
        try {
            let page = 0;
            let hasMore = false;

            do {
                const response = await getSdk().sdk.auth.getUsersList({
                    page,
                    pageSize: USERS_PAGE_SIZE,
                });
                const users = response?.users || [];
                for (const user of users) {
                    const id = makeUserId(user.userId);
                    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
                    const label = user.login || fullName || user.email || user.userId;
                    const sublabel =
                        fullName && fullName !== label
                            ? fullName
                            : user.email && user.email !== label
                              ? user.email
                              : undefined;

                    authors.push({
                        id,
                        label,
                        sublabel,
                        matchValues: uniqueStrings([id, user.userId, user.login]),
                    });
                }
                hasMore = Boolean(response?.nextPageToken);
                page += 1;
            } while (hasMore && page < MAX_USER_PAGES);
        } catch (_err) {
            // Non-admin users or setups without auth user listing gracefully fall back
            // to authors observed in entries + current user.
        }
    }

    if (DL.USER_ID || DL.USER_LOGIN) {
        const id = DL.USER_ID ? makeUserId(DL.USER_ID) : DL.USER_LOGIN;
        const label = DL.USER_LOGIN || DL.USER_DISPLAY_NAME || DL.USER_ID;
        const sublabel =
            DL.USER_DISPLAY_NAME && DL.USER_DISPLAY_NAME !== label
                ? DL.USER_DISPLAY_NAME
                : undefined;

        if (id && label) {
            authors.push({
                id,
                label,
                sublabel,
                matchValues: uniqueStrings([
                    DL.USER_ID ? makeUserId(DL.USER_ID) : null,
                    DL.USER_ID,
                    DL.USER_LOGIN,
                ]),
            });
        }
    }

    const merged = mergeAuthorOptions([], authors);
    cachedAuthors = merged;
    cachedAt = Date.now();
    return merged;
}

export function buildAuthorOptionsFromEntries(
    entries: Array<{createdBy?: string}> = [],
    usersByIds: Record<string, {status?: string; login?: string}> = {},
): AuthorFilterOption[] {
    const options: AuthorFilterOption[] = [];

    for (const entry of entries) {
        const createdBy = entry?.createdBy;
        if (!createdBy) {
            continue;
        }

        if (isUserId(createdBy)) {
            const rawId = getUserId(createdBy);
            const resolved = usersByIds[rawId];
            const login = resolved?.status === 'resolved' ? resolved.login : undefined;
            options.push({
                id: createdBy,
                label: login || rawId,
                matchValues: uniqueStrings([createdBy, rawId, login]),
            });
        } else {
            options.push({
                id: createdBy,
                label: createdBy,
                matchValues: [createdBy],
            });
        }
    }

    return options;
}

export function mergeAuthorOptions(
    existing: AuthorFilterOption[] = [],
    incoming: AuthorFilterOption[] = [],
): AuthorFilterOption[] {
    const list: AuthorFilterOption[] = [];

    const addOption = (opt: AuthorFilterOption) => {
        if (!opt?.id) {
            return;
        }
        const matchIndex = list.findIndex(
            (item) =>
                item.id === opt.id ||
                item.matchValues.includes(opt.id) ||
                opt.matchValues.includes(item.id),
        );

        if (matchIndex === -1) {
            list.push({
                id: opt.id,
                label: opt.label || opt.id,
                sublabel: opt.sublabel,
                matchValues: uniqueStrings([opt.id, ...opt.matchValues]),
            });
            return;
        }

        const prev = list[matchIndex];
        const preferIncomingId = isUserId(opt.id) && !isUserId(prev.id);
        const preferredLabel =
            opt.label && !isUserId(opt.label) && opt.label !== getUserId(opt.id)
                ? opt.label
                : prev.label;

        list[matchIndex] = {
            id: preferIncomingId ? opt.id : prev.id,
            label: preferredLabel || opt.label || prev.label,
            sublabel: opt.sublabel || prev.sublabel,
            matchValues: uniqueStrings([prev.id, opt.id, ...prev.matchValues, ...opt.matchValues]),
        };
    };

    existing.forEach(addOption);
    incoming.forEach(addOption);

    return list.sort((a, bItem) => a.label.localeCompare(bItem.label));
}

export function resolveSelectedAuthorTokens(
    selectedAuthorIds: string[],
    authors: AuthorFilterOption[],
): string[] {
    const tokens: string[] = [];

    for (const selectedId of selectedAuthorIds) {
        const option = authors.find(
            (author) => author.id === selectedId || author.matchValues.includes(selectedId),
        );
        if (option) {
            tokens.push(...option.matchValues);
        } else {
            tokens.push(selectedId);
            if (isUserId(selectedId)) {
                tokens.push(getUserId(selectedId));
            }
        }
    }

    return uniqueStrings(tokens);
}

type AuthorFilterSelectProps = {
    value: string[];
    options: AuthorFilterOption[];
    loading?: boolean;
    disabled?: boolean;
    onChange: (authorIds: string[]) => void;
};

export const AuthorFilterSelect = ({
    value,
    options,
    loading,
    disabled,
    onChange,
}: AuthorFilterSelectProps) => {
    const selectOptions: SelectOption[] = React.useMemo(
        () =>
            options.map((author) => ({
                value: author.id,
                content: author.label,
                text: author.sublabel ? `${author.label} ${author.sublabel}` : author.label,
                data: author,
            })),
        [options],
    );

    const renderOption = React.useCallback((option: SelectOption<AuthorFilterOption>) => {
        const author = option.data;
        return (
            <div className={b('option')}>
                <Icon className={b('option-icon')} data={Person} size={14} />
                <div className={b('option-text')}>
                    <span className={b('option-title')}>{author?.label ?? option.content}</span>
                    {author?.sublabel && (
                        <span className={b('option-sublabel')}>{author.sublabel}</span>
                    )}
                </div>
            </div>
        );
    }, []);

    return (
        <Select
            className={b()}
            popupClassName={b('popup')}
            qa="navigation-author-filter"
            multiple={true}
            filterable={true}
            hasClear={true}
            loading={loading}
            disabled={disabled}
            value={value}
            options={selectOptions}
            renderOption={renderOption}
            getOptionHeight={(option: SelectOption<AuthorFilterOption>) =>
                option.data?.sublabel ? 42 : 28
            }
            placeholder={i18n('label_placeholder-author-filter')}
            filterPlaceholder={i18n('label_placeholder-author-search')}
            onUpdate={onChange}
        />
    );
};

export default AuthorFilterSelect;
