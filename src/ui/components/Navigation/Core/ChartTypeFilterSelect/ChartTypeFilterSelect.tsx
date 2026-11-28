import React from 'react';

import {Select} from '@gravity-ui/uikit';
import type {SelectOption} from '@gravity-ui/uikit';
import block from 'bem-cn-lite';
import {I18n} from 'i18n';
import {ENTRY_TYPES} from 'shared';
import {isEditorEntryType} from 'shared/utils/entry';

import './ChartTypeFilterSelect.scss';

const b = block('dl-core-navigation-chart-type-filter');
const i18n = I18n.keyset('component.navigation.view');

export type ChartTypeFilterValue = 'editor' | 'wizard' | 'ql';

const WIZARD_TYPES = new Set<string>(ENTRY_TYPES.wizard);
const QL_TYPES = new Set<string>(ENTRY_TYPES.ql);

export function getEntryChartTypeCategory(entryType?: string): ChartTypeFilterValue | null {
    if (!entryType) {
        return null;
    }
    if (WIZARD_TYPES.has(entryType)) {
        return 'wizard';
    }
    if (QL_TYPES.has(entryType)) {
        return 'ql';
    }
    if (isEditorEntryType(entryType)) {
        return 'editor';
    }
    return null;
}

export function matchesChartTypeFilter(entryType: string | undefined, selectedTypes: string[]) {
    if (!selectedTypes || selectedTypes.length === 0) {
        return true;
    }
    const category = getEntryChartTypeCategory(entryType);
    return Boolean(category && selectedTypes.includes(category));
}

type ChartTypeFilterSelectProps = {
    value: string[];
    onChange: (types: string[]) => void;
};

export const ChartTypeFilterSelect = ({value, onChange}: ChartTypeFilterSelectProps) => {
    const options: SelectOption[] = React.useMemo(
        () => [
            {value: 'editor', content: i18n('value_chart-type-editor')},
            {value: 'wizard', content: i18n('value_chart-type-wizard')},
            {value: 'ql', content: i18n('value_chart-type-ql')},
        ],
        [],
    );

    return (
        <Select
            className={b()}
            qa="navigation-chart-type-filter"
            multiple={true}
            hasClear={true}
            value={value}
            options={options}
            placeholder={i18n('label_placeholder-chart-type-filter')}
            onUpdate={onChange}
        />
    );
};

export default ChartTypeFilterSelect;
