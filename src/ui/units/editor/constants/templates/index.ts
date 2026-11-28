import {EDITOR_TYPE} from 'shared/constants';
import type {GetEditorTemplatesArgs} from 'ui/registry/units/editor/types/functions/getEditorTemplates';

export type EditorTemplateCategory = 'dashsql' | 'dataset' | 'controls' | 'other';

export type EditorTemplateItem = {
    qa: string;
    type: string;
    name: string;
    title: string;
    description: string;
    badge: string;
    category: EditorTemplateCategory;
    scope: 'widget';
    savedId: string;
    revId: string;
    publishedId: string;
    data: Record<string, string>;
};

function buildDashSqlTableTemplate(connectionId?: string): EditorTemplateItem {
    const pgId = connectionId || '<CONNECTION_ID>';
    return {
        qa: 'editor-template-dashsql-table',
        type: EDITOR_TYPE.TABLE_NODE,
        name: 'dashsql-table',
        title: 'DashSQL + Таблица',
        description:
            'Прямой SQL-запрос к Postgres/ClickHouse через Editor.getId("PG"), парсер NDJSON, форматирование чисел и контрол лимита строк.',
        badge: 'DashSQL',
        category: 'dashsql',
        scope: 'widget',
        savedId: '1',
        revId: '1',
        publishedId: '1',
        data: {
            meta: JSON.stringify(
                {
                    links: {
                        PG: pgId,
                    },
                },
                null,
                4,
            ),
            params: `module.exports = {
    limit: ['50'],
};`,
            sources: `const params = Editor.getParams();
const rawLimit = Array.isArray(params.limit) ? params.limit[0] : params.limit;
const limit = Math.min(Math.max(Number(rawLimit) || 50, 1), 1000);
const connId = Editor.getId('PG');

if (!connId || connId.startsWith('<')) {
    module.exports = {};
} else {
    module.exports = {
        sql: {
            url: \`/_bi_connections/\${connId}/dashsql\`,
            method: 'POST',
            // Переопределить TTL кэша можно так: cache: '15m' (или cache: 0 чтобы отключить)
            data: {
                sql_query: \`
                    SELECT
                        current_date - (g * interval '1 day') AS dt,
                        'Channel ' || ((g % 3) + 1) AS channel,
                        (100 + g * 17) AS users,
                        round((1250.5 + g * 83.2)::numeric, 2) AS revenue
                    FROM generate_series(0, \${limit - 1}) AS g
                    ORDER BY dt DESC
                \`,
            },
        },
    };
}`,
            prepare: `const loaded = Editor.getLoadedData().sql;

function formatNumber(val, decimals = 0) {
    if (val === null || val === undefined || val === '') {
        return '';
    }
    return Number(val)
        .toFixed(decimals)
        .replace(/\\B(?=(\\d{3})+(?!\\d))/g, ' ');
}

let records = [];
if (!loaded) {
    // Демо-данные до привязки подключения во вкладке Meta -> «+ Связь»
    records = [
        {dt: '2026-11-27', channel: 'SEO (демо)', users: 1420, revenue: 48250.5},
        {dt: '2026-11-26', channel: 'Paid (демо)', users: 980, revenue: 35100.0},
        {dt: '2026-11-25', channel: 'Direct (демо)', users: 760, revenue: 21840.25},
    ];
} else {
    const events =
        typeof loaded === 'string' ? loaded.trim().split('\\n').filter(Boolean).map(JSON.parse) : loaded;
    const failure = events.find((e) => e.event === 'error');
    if (failure) {
        throw new Error(failure.data?.message || 'DashSQL query error');
    }
    const meta = events.find((e) => e.event === 'metadata');
    const names = meta?.data?.names || [];
    records = events
        .filter((e) => e.event === 'row')
        .map((e) => Object.fromEntries(names.map((name, idx) => [name, e.data[idx]])));
}

const head = [
    {id: 'dt', name: 'Дата', type: 'text'},
    {id: 'channel', name: 'Канал', type: 'text'},
    {id: 'users', name: 'Пользователи', type: 'number'},
    {id: 'revenue', name: 'Выручка', type: 'number'},
];

const rows = records.map((r) => ({
    cells: [
        {value: String(r.dt ?? '')},
        {value: String(r.channel ?? '')},
        {value: Number(r.users || 0), formattedValue: formatNumber(r.users, 0)},
        {value: Number(r.revenue || 0), formattedValue: formatNumber(r.revenue, 2)},
    ],
}));

module.exports = {head, rows};`,
            controls: `module.exports = {
    controls: [
        {
            type: 'select',
            param: 'limit',
            title: 'Строк',
            updateOnChange: true,
            content: [
                {title: '20', value: '20'},
                {title: '50', value: '50'},
                {title: '200', value: '200'},
            ],
        },
    ],
};`,
            config: `module.exports = {
    title: 'DashSQL таблица',
    paginator: {
        enabled: true,
        limit: 50,
    },
};`,
        },
    };
}

function buildDashSqlHeatmapTemplate(connectionId?: string): EditorTemplateItem {
    const pgId = connectionId || '<CONNECTION_ID>';
    return {
        qa: 'editor-template-dashsql-heatmap',
        type: EDITOR_TYPE.TABLE_NODE,
        name: 'dashsql-heatmap',
        title: 'DashSQL + Heatmap',
        description:
            'Когортная / матричная тепловая карта на базе DashSQL с градиентной подсветкой ячеек и готовым NDJSON-парсером.',
        badge: 'DashSQL',
        category: 'dashsql',
        scope: 'widget',
        savedId: '1',
        revId: '1',
        publishedId: '1',
        data: {
            meta: JSON.stringify(
                {
                    links: {
                        PG: pgId,
                    },
                },
                null,
                4,
            ),
            params: `module.exports = {
    metric: ['retention'],
};`,
            sources: `const connId = Editor.getId('PG');

if (!connId || connId.startsWith('<')) {
    module.exports = {};
} else {
    module.exports = {
        sql: {
            url: \`/_bi_connections/\${connId}/dashsql\`,
            method: 'POST',
            data: {
                sql_query: \`
                    -- Замените SQL на ваш когортный запрос
                    SELECT '2026-11-01' AS cohort, 1000 AS users, 42.5 AS d1, 28.0 AS d7, 19.4 AS d14, 12.8 AS d30
                    UNION ALL
                    SELECT '2026-11-08', 1150, 45.1, 31.2, 22.0, 14.5
                \`,
            },
        },
    };
}`,
            prepare: `const loaded = Editor.getLoadedData().sql;

let records = [];
if (!loaded) {
    // Демо-когорты до привязки подключения во вкладке Meta -> «+ Связь»
    records = [
        {cohort: '2026-11-01', users: 1240, d1: 46.2, d7: 31.5, d14: 22.8, d30: 15.1},
        {cohort: '2026-11-08', users: 1390, d1: 49.0, d7: 34.1, d14: 24.0, d30: 16.8},
        {cohort: '2026-11-15', users: 1510, d1: 52.4, d7: 36.8, d14: 25.5, d30: null},
    ];
} else {
    const events =
        typeof loaded === 'string' ? loaded.trim().split('\\n').filter(Boolean).map(JSON.parse) : loaded;
    const failure = events.find((e) => e.event === 'error');
    if (failure) {
        throw new Error(failure.data?.message || 'DashSQL error');
    }
    const meta = events.find((e) => e.event === 'metadata');
    const names = meta?.data?.names || [];
    records = events
        .filter((e) => e.event === 'row')
        .map((e) => Object.fromEntries(names.map((n, i) => [n, e.data[i]])));
}

const periodCols = [
    ['d1', 'D1'],
    ['d7', 'D7'],
    ['d14', 'D14'],
    ['d30', 'D30'],
];
const maxVal = Math.max(
    1,
    ...records.flatMap((r) => periodCols.map(([k]) => Number(r[k]) || 0)),
);

function heatColor(ratio) {
    const t = Math.max(0, Math.min(1, ratio));
    const from = [232, 245, 233];
    const to = [27, 138, 69];
    const rgb = from.map((c, i) => Math.round(c + (to[i] - c) * t));
    return \`rgb(\${rgb.join(',')})\`;
}

const head = [
    {id: 'cohort', name: 'Когорта', type: 'text', width: 120},
    {id: 'users', name: 'Users', type: 'number', width: 80},
    ...periodCols.map(([id, name]) => ({id, name, type: 'number', width: 80})),
];

const rows = records.map((r) => ({
    cells: [
        {value: String(r.cohort ?? ''), css: {'font-weight': 600}},
        {value: Number(r.users || 0), formattedValue: String(r.users || 0)},
        ...periodCols.map(([key]) => {
            const raw = r[key];
            if (raw === null || raw === undefined) {
                return {value: null, formattedValue: '—'};
            }
            const num = Number(raw);
            const ratio = num / maxVal;
            return {
                value: num,
                formattedValue: \`\${num.toFixed(1)}%\`,
                css: {
                    background: heatColor(ratio),
                    color: ratio > 0.55 ? '#ffffff' : '#0f1d31',
                    'font-weight': 500,
                },
            };
        }),
    ],
}));

module.exports = {head, rows};`,
            controls: `module.exports = {
    controls: [],
};`,
            config: `module.exports = {
    title: 'Когортный Heatmap',
    paginator: {
        enabled: false,
    },
};`,
        },
    };
}

function buildDatasetV2TableTemplate(): EditorTemplateItem {
    return {
        qa: 'editor-template-dataset-v2-table',
        type: EDITOR_TYPE.TABLE_NODE,
        name: 'dataset-v2-table',
        title: 'Dataset v2 + Таблица',
        description:
            'Чтение колонок из датасета DataLens через libs/dataset/v2 и Editor.getId("DATASET") с построением таблицы.',
        badge: 'Dataset v2',
        category: 'dataset',
        scope: 'widget',
        savedId: '1',
        revId: '1',
        publishedId: '1',
        data: {
            meta: JSON.stringify(
                {
                    links: {
                        DATASET: '<DATASET_ID>',
                    },
                },
                null,
                4,
            ),
            params: `module.exports = {};`,
            sources: `const {buildSource} = require('libs/dataset/v2');
const datasetId = Editor.getId('DATASET');

if (!datasetId || datasetId.startsWith('<')) {
    module.exports = {};
} else {
    module.exports = {
        data: buildSource({
            datasetId,
            // Укажите реальные названия полей вашего датасета:
            columns: ['category', 'amount'],
        }),
    };
}`,
            prepare: `const loaded = Editor.getLoadedData().data;

let columns = ['category', 'amount'];
let rawRows = [
    ['Подключите датасет (Meta -> + Связь)', 100],
    ['Пример строки 2', 245],
];

if (loaded?.result_data?.[0]?.rows) {
    const block = loaded.result_data[0];
    columns = (loaded.fields || []).map((f) => f.title || f.guid);
    rawRows = block.rows.map((row) => row.data);
}

const head = columns.map((name, idx) => ({
    id: \`col_\${idx}\`,
    name,
    type: 'text',
}));

const rows = rawRows.map((row) => ({
    cells: row.map((val) => ({
        value: val,
        formattedValue: val === null || val === undefined ? '' : String(val),
    })),
}));

module.exports = {head, rows};`,
            controls: `module.exports = {
    controls: [],
};`,
            config: `module.exports = {
    title: 'Таблица из датасета',
    paginator: {
        enabled: true,
        limit: 50,
    },
};`,
        },
    };
}

function buildDatasetV2GravityTemplate(): EditorTemplateItem {
    return {
        qa: 'editor-template-dataset-v2-gravity',
        type: EDITOR_TYPE.GRAVITY_CHARTS_NODE,
        name: 'dataset-v2-gravity',
        title: 'Dataset v2 + Gravity Chart',
        description:
            'Интерактивный график Gravity Charts (d3_node) на базе libs/dataset/v2 с готовой конфигурацией осей и легенды.',
        badge: 'Dataset v2',
        category: 'dataset',
        scope: 'widget',
        savedId: '1',
        revId: '1',
        publishedId: '1',
        data: {
            meta: JSON.stringify(
                {
                    links: {
                        DATASET: '<DATASET_ID>',
                    },
                },
                null,
                4,
            ),
            params: `module.exports = {};`,
            sources: `const {buildSource} = require('libs/dataset/v2');
const datasetId = Editor.getId('DATASET');

if (!datasetId || datasetId.startsWith('<')) {
    module.exports = {};
} else {
    module.exports = {
        data: buildSource({
            datasetId,
            // Укажите ось X и меру Y из вашего датасета:
            columns: ['month', 'value'],
        }),
    };
}`,
            prepare: `const loaded = Editor.getLoadedData().data;

let points = [
    {x: 'Сен', y: 120},
    {x: 'Окт', y: 168},
    {x: 'Ноя', y: 215},
    {x: 'Дек', y: 248},
];

if (loaded?.result_data?.[0]?.rows) {
    points = loaded.result_data[0].rows.map((row) => ({
        x: String(row.data[0] ?? ''),
        y: Number(row.data[1] || 0),
    }));
}

module.exports = {
    series: {
        data: [
            {
                type: 'bar-x',
                name: 'Показатель',
                data: points,
            },
        ],
    },
    xAxis: {
        type: 'category',
        categories: points.map((p) => p.x),
    },
    yAxis: [
        {
            title: {text: 'Значение'},
        },
    ],
    legend: {
        enabled: true,
    },
};`,
            controls: `module.exports = {
    controls: [],
};`,
            config: `module.exports = {
    title: 'Gravity Chart (Dataset v2)',
};`,
        },
    };
}

function buildCustomControlsTemplate(): EditorTemplateItem {
    return {
        qa: 'editor-template-custom-controls',
        type: EDITOR_TYPE.CONTROL_NODE,
        name: 'custom-controls',
        title: 'Кастомные контролы',
        description:
            'Селектор для дашборда (control_node) с выпадающими списками, чекбоксом и пробросом параметров в чарты.',
        badge: 'Controls',
        category: 'controls',
        scope: 'widget',
        savedId: '1',
        revId: '1',
        publishedId: '1',
        data: {
            meta: JSON.stringify({links: {}}, null, 4),
            params: `module.exports = {
    period: ['days'],
    metric: ['players'],
    only_active: ['false'],
};`,
            sources: `// При необходимости можно подгружать список опций из датасета или DashSQL:
// const {buildSource} = require('libs/dataset/v2');
module.exports = {};`,
            controls: `module.exports = {
    controls: [
        {
            type: 'select',
            param: 'period',
            title: 'Гранулярность',
            updateOnChange: true,
            content: [
                {title: 'Дни', value: 'days'},
                {title: 'Недели', value: 'weeks'},
                {title: 'Месяцы', value: 'months'},
            ],
        },
        {
            type: 'select',
            param: 'metric',
            title: 'Метрика',
            updateOnChange: true,
            content: [
                {title: 'Игроки', value: 'players'},
                {title: 'Депозиты', value: 'deposits'},
                {title: 'Выручка', value: 'revenue'},
            ],
        },
        {
            type: 'checkbox',
            param: 'only_active',
            title: 'Только активные',
            updateOnChange: true,
        },
    ],
};`,
        },
    };
}

function buildMarkdownKpiTemplate(): EditorTemplateItem {
    return {
        qa: 'editor-template-markdown-kpi',
        type: EDITOR_TYPE.MARKDOWN_NODE,
        name: 'markdown-kpi',
        title: 'Markdown / KPI-сводка',
        description:
            'Текстовый блок с динамическими цифрами и Markdown-разметкой для заголовков и KPI-панелей дашборда.',
        badge: 'Markdown',
        category: 'other',
        scope: 'widget',
        savedId: '1',
        revId: '1',
        publishedId: '1',
        data: {
            meta: JSON.stringify({links: {}}, null, 4),
            params: `module.exports = {
    period: ['Текущий месяц'],
};`,
            sources: `module.exports = {};`,
            prepare: `const params = Editor.getParams();
const period = Array.isArray(params.period) ? params.period[0] : params.period || 'Период';

module.exports = {
    markdown: [
        \`### Сводка за \${period}\`,
        '',
        '| Метрика | Значение | Динамика |',
        '| --- | ---: | ---: |',
        '| Выручка | **1 240 500** | +14.2% |',
        '| Активные пользователи | **8 420** | +6.8% |',
    ].join('\\n'),
};`,
        },
    };
}

function buildEmptyTableTemplate(): EditorTemplateItem {
    return {
        qa: 'editor-template-empty-table',
        type: EDITOR_TYPE.TABLE_NODE,
        name: 'empty-table',
        title: 'Пустая таблица',
        description: 'Минимальный чистый шаблон table_node для старта с нуля.',
        badge: 'Пустой',
        category: 'other',
        scope: 'widget',
        savedId: '1',
        revId: '1',
        publishedId: '1',
        data: {
            meta: JSON.stringify({links: {}}, null, 4),
            params: 'module.exports = {};',
            sources: 'module.exports = {};',
            prepare: 'module.exports = {head: [], rows: []};',
            controls: 'module.exports = {controls: []};',
            config: 'module.exports = {};',
        },
    };
}

function buildEmptyGravityTemplate(): EditorTemplateItem {
    return {
        qa: 'editor-template-empty-gravity',
        type: EDITOR_TYPE.GRAVITY_CHARTS_NODE,
        name: 'empty-gravity',
        title: 'Пустой Gravity-чарт',
        description: 'Минимальный чистый шаблон d3_node (Gravity Charts) для старта с нуля.',
        badge: 'Пустой',
        category: 'other',
        scope: 'widget',
        savedId: '1',
        revId: '1',
        publishedId: '1',
        data: {
            meta: JSON.stringify({links: {}}, null, 4),
            params: 'module.exports = {};',
            sources: 'module.exports = {};',
            prepare: 'module.exports = {series: {data: []}};',
            controls: 'module.exports = {controls: []};',
            config: 'module.exports = {};',
        },
    };
}

export const getEditorTemplates = (args?: GetEditorTemplatesArgs): EditorTemplateItem[] => {
    const connectionId = args?.connectionId;

    return [
        buildDashSqlTableTemplate(connectionId),
        buildDashSqlHeatmapTemplate(connectionId),
        buildDatasetV2TableTemplate(),
        buildDatasetV2GravityTemplate(),
        buildCustomControlsTemplate(),
        buildMarkdownKpiTemplate(),
        buildEmptyTableTemplate(),
        buildEmptyGravityTemplate(),
    ];
};
