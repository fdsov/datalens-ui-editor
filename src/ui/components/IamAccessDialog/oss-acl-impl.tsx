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

// the "everyone" wildcard subject — sub '*' (UserAccount subType so getAccessSubjectType
// doesn't throw); the us access-bindings controller maps id '*' to subject_type='all'.
const ALL_USERS_SUBJECT = {
    sub: '*',
    subType: ClaimsSubjectType.UserAccount,
    name: 'Все пользователи',
    preferredUsername: 'Все пользователи',
    email: '',
    givenName: '',
    familyName: '',
};

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
                {/* "Все пользователи" — wildcard subject (sub '*'); grants access to everyone */}
                <div
                    onClick={() => onSubjectChange(ALL_USERS_SUBJECT as any)}
                    style={{padding: '6px 8px', cursor: 'pointer', borderRadius: 4, fontWeight: 500}}
                >
                    {ALL_USERS_SUBJECT.name}
                </div>
                {items.map((s) => (
                    <div
                        key={s.sub}
                        onClick={() => onSubjectChange(s)}
                        style={{padding: '6px 8px', cursor: 'pointer', borderRadius: 4}}
                    >
                        {subjectLabel(s)}
                    </div>
                ))}
            </div>
        </div>
    );
};
