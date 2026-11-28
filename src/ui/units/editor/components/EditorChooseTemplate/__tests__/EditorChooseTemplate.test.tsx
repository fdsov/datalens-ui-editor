import React from 'react';

import {ThemeProvider} from '@gravity-ui/uikit';
import {fireEvent, render, screen} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {Router} from 'react-router-dom';
import {ENTRY_TYPES} from 'shared';
import {registry} from 'ui/registry';

import {getEditorTemplates} from '../../../constants/templates';
import {EditorChooseTemplate} from '../EditorChooseTemplate';

describe('JS Editor templates & EditorChooseTemplate', () => {
    beforeEach(() => {
        jest.spyOn(registry.editor.functions, 'get').mockImplementation((name: string) => {
            if (name === 'getEditorTemplates') {
                return getEditorTemplates;
            }
            return jest.fn();
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('getEditorTemplates returns valid templates with valid JSON meta and supported editor types', () => {
        const templates = getEditorTemplates({connectionId: 'conn-pg-1'});
        expect(templates.length).toBeGreaterThanOrEqual(6);

        const names = templates.map((t) => t.name);
        expect(names).toEqual(
            expect.arrayContaining([
                'dashsql-table',
                'dashsql-heatmap',
                'dataset-v2-table',
                'dataset-v2-gravity',
                'custom-controls',
                'markdown-kpi',
            ]),
        );

        templates.forEach((tpl) => {
            expect(ENTRY_TYPES.editor).toContain(tpl.type);
            expect(() => JSON.parse(tpl.data.meta)).not.toThrow();
        });

        const dashSqlTable = templates.find((t) => t.name === 'dashsql-table');
        expect(JSON.parse(dashSqlTable!.data.meta)).toEqual({
            links: {PG: 'conn-pg-1'},
        });
    });

    test('EditorChooseTemplate renders gallery and navigates to draft/:template preserving workbookId and query', () => {
        const history = createMemoryHistory({
            initialEntries: ['/workbooks/wb-42/editor/new?connectionId=conn-99'],
        });
        const onClick = jest.fn();

        render(
            <ThemeProvider theme="light">
                <Router history={history}>
                    <EditorChooseTemplate workbookId="wb-42" onClick={onClick} />
                </Router>
            </ThemeProvider>,
        );

        expect(screen.getByText('DashSQL + Таблица')).toBeInTheDocument();
        expect(screen.getByText('Dataset v2 + Gravity Chart')).toBeInTheDocument();
        expect(screen.getByText('Кастомные контролы')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('editor-template-dashsql-table'));

        expect(onClick).toHaveBeenCalledWith('dashsql-table');
        expect(history.location.pathname).toBe('/workbooks/wb-42/editor/draft/dashsql-table');
        expect(history.location.search).toBe('?connectionId=conn-99');
    });
});
