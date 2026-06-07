import React from 'react';

import {TextInput} from '@gravity-ui/uikit';

import {ClaimsSubjectType} from '../../../shared/schema/extensions/types';
import type {AclSubjectProps} from '../../registry/units/common/types/components/AclSubject';
import type {AclSubjectSuggestProps} from '../../registry/units/common/types/components/AclSubjectSuggest';

// Minimal OSS implementations for the access-dialog "add user" flow. The cloud build ships
// IAM-backed versions; OSS stubbed them empty (which crashed the AddSubjects view). These wire
// the user picker to the patched batchListMembers gateway action via the passed fetchSubjects.

const subjectLabel = (s: {name?: string; preferredUsername?: string; sub?: string}) =>
    s?.name || s?.preferredUsername || s?.sub || '';

export const AclSubjectImpl = ({subjectClaims}: AclSubjectProps) => (
    <div>{subjectLabel(subjectClaims)}</div>
);

export const AclSubjectSuggestImpl = ({fetchSubjects, onSubjectChange}: AclSubjectSuggestProps) => {
    const [search, setSearch] = React.useState('');
    const [items, setItems] = React.useState<any[]>([]);

    React.useEffect(() => {
        let active = true;
        if (!fetchSubjects) {
            return undefined;
        }
        Promise.resolve(fetchSubjects(search, ClaimsSubjectType.UserAccount)).then((res) => {
            if (!active) {
                return;
            }
            const subjects = Array.isArray(res) ? res : res?.subjects;
            setItems(subjects || []);
        });
        return () => {
            active = false;
        };
    }, [search, fetchSubjects]);

    return (
        <div style={{padding: 8, width: 300}}>
            <TextInput
                autoFocus
                placeholder="Поиск пользователя"
                value={search}
                onUpdate={setSearch}
            />
            <div style={{marginTop: 8, maxHeight: 240, overflowY: 'auto'}}>
                {items.map((s) => (
                    <div
                        key={s.sub}
                        onClick={() => onSubjectChange(s)}
                        style={{padding: '6px 8px', cursor: 'pointer', borderRadius: 4}}
                    >
                        {subjectLabel(s)}
                    </div>
                ))}
                {items.length === 0 && (
                    <div style={{padding: 8, opacity: 0.6}}>Нет пользователей</div>
                )}
            </div>
        </div>
    );
};
