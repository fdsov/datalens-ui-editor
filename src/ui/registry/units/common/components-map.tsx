import {RangeInputPicker} from 'ui/components/common/RangeInputPicker';
import {IamAccessDialogComponent as RealIamAccessDialogComponent} from 'ui/components/IamAccessDialog/IamAccessDialogComponent';
import {AclSubjectImpl, AclSubjectSuggestImpl} from 'ui/components/IamAccessDialog/oss-acl-impl';
import type {ShareButtonProps} from 'ui/units/dash/components/ShareButton/ShareButton';

import {Datepicker} from '../../../components/common/Datepicker/Datepicker';
import type {DatepickerControlProps} from '../../../components/common/DatepickerControl/DatepickerControl';
import Timings from '../../../libs/DatalensChartkit/components/ChartKitBase/components/Header/components/Menu/Items/Inspector/Timings/Timings';
import type {WorkbookEntriesTableTabsProps} from '../../../units/workbooks/components/Table/WorkbookEntriesTable/WorkbookEntriesTableTabs';
import {makeDefaultEmpty} from '../../components/DefaultEmpty';

import {Example} from './components/Example/Example';
import {EXAMPLE_COMPONENT} from './constants/components';
import type {AccessRightsProps} from './types/components/AccessRights';
import type {AccessRightsUrlOpenProps} from './types/components/AccessRightsUrlOpen';
import type {ActionPanelEntrySelectProps} from './types/components/ActionPanelEntrySelect';
import type {ButtonFavoriteProps} from './types/components/ButtonFavorite';
import type {DialogAddParticipantsProps} from './types/components/DialogAddParticipants';
import type {DialogEntryDescriptionProps} from './types/components/DialogEntryDescription';
import type {DialogImageWidgetLinkHintProps} from './types/components/DialogImageWidgetLinkHint';
import type {DialogRelatedEntitiesRadioHintProps} from './types/components/DialogRelatedEntitiesRadioHint';
import type {DialogShareProps} from './types/components/DialogShare';
import type {DownloadScreenshotProps} from './types/components/DownloadScreenshot';
import type {EntryBreadcrumbsProps} from './types/components/EntryBreadcrumbs';
import type {MarkdownControlProps} from './types/components/MarkdownControl';
import type {MarkupShareLinkProps} from './types/components/MarkupShareLink';
import type {MarkupUserInfoProps} from './types/components/MarkupUserInfo';
import type {MobileHeaderComponentProps} from './types/components/MobileHeaderComponent';
import type {OAuthTokenButtonProps} from './types/components/OAuthTokenButton';
import type {PlaceholderIllustrationImageProps} from './types/components/PlaceholderIllustrationImage';
import type {ReportButtonProps} from './types/components/ReportButton';
import type {UserAvatarByIdProps} from './types/components/UserAvatarById';
import type {YfmWrapperProps} from './types/components/YfmWrapper';

export const commonComponentsMap = {
    [EXAMPLE_COMPONENT]: Example,
    DownloadScreenshot: makeDefaultEmpty<DownloadScreenshotProps>(),
    YfmWrapperContent: makeDefaultEmpty<YfmWrapperProps>(),
    ActionPanelEntrySelect: makeDefaultEmpty<ActionPanelEntrySelectProps>(),
    EntryBreadcrumbs: makeDefaultEmpty<EntryBreadcrumbsProps>(),
    MobileHeaderComponent: makeDefaultEmpty<MobileHeaderComponentProps>(),
    PlaceholderIllustrationImage: makeDefaultEmpty<PlaceholderIllustrationImageProps>(),
    ReportButton: makeDefaultEmpty<ReportButtonProps>(),
    AccessRights: makeDefaultEmpty<AccessRightsProps>(),
    DialogAddParticipants: makeDefaultEmpty<DialogAddParticipantsProps>(),
    AccessRightsUrlOpenComponent: makeDefaultEmpty<AccessRightsUrlOpenProps>(),
    IamAccessDialogComponent: RealIamAccessDialogComponent,
    UserAvatarById: makeDefaultEmpty<UserAvatarByIdProps>(),
    Datepicker,
    DatepickerControl: makeDefaultEmpty<DatepickerControlProps>(),
    Timings,
    RangeInputPicker,
    ButtonFavorite: makeDefaultEmpty<ButtonFavoriteProps>(),
    OAuthTokenButton: makeDefaultEmpty<OAuthTokenButtonProps>(),
    MarkupShareLink: makeDefaultEmpty<MarkupShareLinkProps>(),
    MarkupUserInfo: makeDefaultEmpty<MarkupUserInfoProps>(),
    MarkdownControl: makeDefaultEmpty<MarkdownControlProps>(),
    Footer: makeDefaultEmpty(),
    AclSubject: AclSubjectImpl,
    AclSubjectSuggest: AclSubjectSuggestImpl,
    DialogShare: makeDefaultEmpty<DialogShareProps>(),
    ShareButton: makeDefaultEmpty<ShareButtonProps>(),
    DialogImageWidgetLinkHint: makeDefaultEmpty<DialogImageWidgetLinkHintProps>(),
    DialogRelatedEntitiesRadioHint: makeDefaultEmpty<DialogRelatedEntitiesRadioHintProps>(),
    WorkbookEntriesTableTabs: makeDefaultEmpty<WorkbookEntriesTableTabsProps>(),
    WorkbookEntryExtended: makeDefaultEmpty<WorkbookEntriesTableTabsProps>(),
    DialogEntryDescription: makeDefaultEmpty<DialogEntryDescriptionProps>(),
} as const;
