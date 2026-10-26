import {I18n} from 'i18n';
import type {ResourceType} from 'ui/registry/units/common/types/components/IamAccessDialog';

import type {SubjectClaims, SubjectDetails} from '../../../shared/schema/extensions/types';
import {ClaimsSubjectType, SubjectType} from '../../../shared/schema/extensions/types';
import {SYSTEM_GROUP_IDS} from '../../constants/common';

export const getResourceRoles = (_type: ResourceType) => {
    const i18n = I18n.keyset('component.iam-access-dialog');

    // OSS native-acl: IAM_RESOURCES is empty here, so provide the workbook roles directly.
    // The role `value` is the roleId; the us access-bindings endpoint maps it by suffix.
    return [
        {title: i18n('role_viewer'), value: 'datalens.workbooks.viewer'},
        {title: i18n('role_editor'), value: 'datalens.workbooks.editor'},
        {title: i18n('role_admin'), value: 'datalens.workbooks.admin'},
    ];
};

export const filterByUser = (searchString: string) => {
    if (!searchString) {
        return () => true;
    }

    const lowerSearchString = searchString.toLowerCase();

    return ({user}: {user?: SubjectDetails}) => {
        return Boolean(
            user?.subjectClaims.name.toLowerCase().includes(lowerSearchString) ||
                user?.subjectClaims.familyName.toLowerCase().includes(lowerSearchString) ||
                user?.subjectClaims.givenName.toLowerCase().includes(lowerSearchString) ||
                user?.subjectClaims.email.toLowerCase().includes(lowerSearchString) ||
                user?.subjectClaims.preferredUsername.toLowerCase().includes(lowerSearchString),
        );
    };
};

export const getAccessSubjectType = (subject: SubjectClaims): SubjectType => {
    if (subject.subType === ClaimsSubjectType.ServiceAccount) {
        return SubjectType.ServiceAccount;
    }

    if (subject.subType === ClaimsSubjectType.UserAccount) {
        if (subject.federation) {
            return SubjectType.FederatedUser;
        }

        return SubjectType.UserAccount;
    }

    if (subject.subType === ClaimsSubjectType.Group) {
        if (SYSTEM_GROUP_IDS.includes(subject.sub)) {
            return SubjectType.System;
        }

        return SubjectType.Group;
    }

    if (subject.subType === ClaimsSubjectType.Invitee) {
        return SubjectType.Invitee;
    }

    throw new Error(`Subject type ${subject.subType} is not supported`);
};
