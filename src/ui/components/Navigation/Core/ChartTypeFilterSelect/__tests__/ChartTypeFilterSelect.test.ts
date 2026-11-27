import {getEntryChartTypeCategory, matchesChartTypeFilter} from '../ChartTypeFilterSelect';

describe('ChartTypeFilterSelect helpers', () => {
    test.each([
        ['table_node', 'editor'],
        ['d3_node', 'editor'],
        ['graph_node', 'editor'],
        ['graph_wizard_node', 'wizard'],
        ['table_wizard_node', 'wizard'],
        ['graph_ql_node', 'ql'],
        ['table_ql_node', 'ql'],
        ['', null],
        [undefined, null],
    ])('classifies %p as %p', (type, expected) => {
        expect(getEntryChartTypeCategory(type)).toBe(expected);
    });

    test('matchesChartTypeFilter filters correctly', () => {
        expect(matchesChartTypeFilter('table_node', [])).toBe(true);
        expect(matchesChartTypeFilter('table_node', ['editor'])).toBe(true);
        expect(matchesChartTypeFilter('table_node', ['wizard', 'ql'])).toBe(false);
        expect(matchesChartTypeFilter('graph_wizard_node', ['wizard', 'editor'])).toBe(true);
        expect(matchesChartTypeFilter('table_ql_node', ['ql'])).toBe(true);
    });
});
