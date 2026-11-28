import React from 'react';

import {ArrowsRotateRight} from '@gravity-ui/icons';
import {ActionTooltip, Button, Icon, Toaster} from '@gravity-ui/uikit';
import {I18n} from 'i18n';

import EntryDialogues from '../../../../../components/EntryDialogues/EntryDialogues';
import {DL} from '../../../../../constants/common';
import {
    invalidateServerCache,
    triggerDashboardChartsReload,
} from '../../../../../utils/cacheRefresh';
import {isEmbeddedMode} from '../../../../../utils/embedded';
import {Description} from '../Description/Description';

import '../DashActionPanel.scss';

const i18n = I18n.keyset('dash.action-panel.view');
const toaster = new Toaster();

type ViewControlsProps = {
    canEdit: boolean;
    progress: boolean;
    isLoadingEditMode: boolean;
    onEditClick: () => void;
    onAccessClick: () => void;
    entryDialoguesRef: React.RefObject<EntryDialogues>;
    isWorkbook?: boolean;
    workbookId?: string;
    showOpenedDescription: boolean;
};

export const ViewControls = (props: ViewControlsProps) => {
    const {
        canEdit,
        progress,
        isLoadingEditMode,
        onEditClick,
        onAccessClick,
        entryDialoguesRef,
        isWorkbook,
        workbookId,
        showOpenedDescription,
    } = props;

    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const handleForceRefresh = React.useCallback(async () => {
        if (isRefreshing) {
            return;
        }
        setIsRefreshing(true);
        try {
            await invalidateServerCache({workbookId});
            triggerDashboardChartsReload();
            toaster.add({
                name: 'dash-force-refresh-cache',
                theme: 'success',
                title: 'Кэш сброшен — обновляем данные дашборда',
                autoHiding: 3000,
            });
        } catch {
            triggerDashboardChartsReload();
            toaster.add({
                name: 'dash-force-refresh-cache-fallback',
                theme: 'warning',
                title: 'Не удалось сбросить кэш, перезагружаем виджеты',
                autoHiding: 3000,
            });
        } finally {
            setIsRefreshing(false);
        }
    }, [isRefreshing, workbookId]);

    if (isEmbeddedMode()) {
        return null;
    }

    const isEditBtnLoading = progress || isLoadingEditMode;

    return (
        <React.Fragment>
            <Description
                canEdit={canEdit}
                onEditClick={onEditClick}
                showOpenedDescription={showOpenedDescription}
            />
            {!DL.IS_MOBILE && (
                <ActionTooltip title="Сбросить кэш и обновить данные дашборда">
                    <Button
                        view="outlined"
                        size="m"
                        loading={isRefreshing}
                        onClick={handleForceRefresh}
                        qa="dash-force-refresh-btn"
                    >
                        <Icon data={ArrowsRotateRight} size={16} />
                        Обновить
                    </Button>
                </ActionTooltip>
            )}
            <EntryDialogues ref={entryDialoguesRef} />
            {canEdit && !DL.IS_MOBILE && (
                <Button
                    view="normal"
                    size="m"
                    loading={isEditBtnLoading}
                    onClick={() => onEditClick()}
                    qa="action-button-edit"
                >
                    {i18n('button_edit')}
                </Button>
            )}
            {!canEdit && !isWorkbook && (
                <Button view="normal" size="m" onClick={onAccessClick}>
                    {i18n('button_request-rights')}
                </Button>
            )}
        </React.Fragment>
    );
};
