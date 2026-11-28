import React from 'react';

import {ChartColumn, Code, Database, FileText, LayoutCellsLarge, Sliders} from '@gravity-ui/icons';
import {Icon, Label} from '@gravity-ui/uikit';
import block from 'bem-cn-lite';
import {useHistory, useLocation} from 'react-router-dom';
import {URL_QUERY} from 'ui/constants/common';
import {registry} from 'ui/registry';
import type {EditorChooseTemplateProps} from 'ui/registry/units/editor/types/components/EditorChooseTemplate';

import {EditorUrls} from '../../constants/common';
import type {EditorTemplateCategory, EditorTemplateItem} from '../../constants/templates';
import {getFullPathName} from '../../utils';

import './EditorChooseTemplate.scss';

const b = block('editor-choose-template');

function getCategoryIcon(category: EditorTemplateCategory, type: string) {
    if (category === 'dashsql') {
        return Database;
    }
    if (category === 'dataset') {
        return type === 'd3_node' ? ChartColumn : LayoutCellsLarge;
    }
    if (category === 'controls') {
        return Sliders;
    }
    if (type === 'markdown_node') {
        return FileText;
    }
    return Code;
}

function getBadgeTheme(
    category: EditorTemplateCategory,
): 'info' | 'success' | 'warning' | 'normal' {
    switch (category) {
        case 'dashsql':
            return 'info';
        case 'dataset':
            return 'success';
        case 'controls':
            return 'warning';
        default:
            return 'normal';
    }
}

export const EditorChooseTemplate: React.FC<EditorChooseTemplateProps> = ({
    workbookId,
    onClick,
}) => {
    const history = useHistory();
    const location = useLocation();

    const connectionId = React.useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get(URL_QUERY.CONNECTION_ID) || undefined;
    }, [location.search]);

    const templates = React.useMemo(() => {
        const getEditorTemplates = registry.editor.functions.get('getEditorTemplates');
        return getEditorTemplates({connectionId}) as EditorTemplateItem[];
    }, [connectionId]);

    const handleSelectTemplate = React.useCallback(
        (template: EditorTemplateItem) => {
            if (onClick) {
                onClick(template.name);
            }
            const basePath = getFullPathName({
                base: EditorUrls.EntryDraft,
                workbookId,
            });
            history.push({
                pathname: `${basePath}/${template.name}`,
                search: location.search,
            });
        },
        [history, location.search, onClick, workbookId],
    );

    return (
        <div className={b()} data-qa="editor-choose-template">
            <div className={b('header')}>
                <h1 className={b('title')}>Выберите шаблон JS-чарта</h1>
                <p className={b('subtitle')}>
                    Каждый шаблон уже настроен под Meta.links и готов к запуску. После открытия
                    можно привязать своё подключение или датасет кнопкой «+ Связь» во вкладке Meta.
                </p>
            </div>
            <div className={b('grid')}>
                {templates.map((tpl) => {
                    const icon = getCategoryIcon(tpl.category, tpl.type);
                    return (
                        <button
                            key={tpl.name}
                            type="button"
                            className={b('card')}
                            data-qa={tpl.qa}
                            onClick={() => handleSelectTemplate(tpl)}
                        >
                            <div className={b('card-top')}>
                                <span className={b('card-icon')}>
                                    <Icon data={icon} size={20} />
                                </span>
                                <Label size="xs" theme={getBadgeTheme(tpl.category)}>
                                    {tpl.badge}
                                </Label>
                            </div>
                            <div className={b('card-title')}>{tpl.title}</div>
                            <div className={b('card-description')}>{tpl.description}</div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default EditorChooseTemplate;
