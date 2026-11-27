import React from 'react';

import {ThemeProvider} from '@gravity-ui/uikit';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {Router} from 'react-router-dom';

import {CommandPalette, openCommandPalette} from '../CommandPalette';

jest.mock('../../Navigation/Core/WorkbookFilterSelect/WorkbookFilterSelect', () => ({
    fetchAccessibleWorkbooks: jest
        .fn()
        .mockResolvedValue([
            {workbookId: 'wb-ret', title: 'RETENTION', collectionPath: 'Analytics'},
        ]),
}));

describe('CommandPalette', () => {
    it('opens via openCommandPalette event and navigates to workbook on click', async () => {
        const history = createMemoryHistory({initialEntries: ['/dashboards']});
        render(
            <ThemeProvider theme="light">
                <Router history={history}>
                    <CommandPalette />
                </Router>
            </ThemeProvider>,
        );

        act(() => {
            openCommandPalette();
        });

        const input = await screen.findByTestId('command-palette-input');
        expect(input).toBeInTheDocument();

        const wbOption = await screen.findByText('RETENTION');
        fireEvent.click(wbOption);

        await waitFor(() => {
            expect(history.location.pathname).toBe('/workbooks/wb-ret');
        });
    });

    it('opens on Cmd+K outside monaco-editor and ignores Cmd+K inside monaco-editor', async () => {
        const history = createMemoryHistory({initialEntries: ['/charts']});
        const {container} = render(
            <ThemeProvider theme="light">
                <Router history={history}>
                    <div className="monaco-editor">
                        <textarea data-qa="monaco-input" />
                    </div>
                    <CommandPalette />
                </Router>
            </ThemeProvider>,
        );

        const monacoInput = screen.getByTestId('monaco-input');
        fireEvent.keyDown(monacoInput, {key: 'k', metaKey: true});
        expect(screen.queryByTestId('command-palette-input')).not.toBeInTheDocument();

        fireEvent.keyDown(container, {key: 'k', metaKey: true});
        expect(await screen.findByTestId('command-palette-input')).toBeInTheDocument();
    });
});
