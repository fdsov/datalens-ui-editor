import {endpoints} from '../constants';

import type {SourceDeclaration} from './types';

const CONNECTIONS_PATH = '/api/data/v1/connections';
const DATASETS_PATH = '/api/data/v2/datasets';

// Self-hosted data-api has no dedicated embedding mode (unlike the cloud installation),
// embedded requests are authorized by the service user instead. `*_embed` sources are kept
// only because charts-engine substitutes them by the `isEmbed` flag - they point to the
// regular data-api endpoints.
export const opensourceSources: SourceDeclaration = {
    development: {
        bi: endpoints.development.api.biData,
        bi_connections: endpoints.development.api.biData + CONNECTIONS_PATH,
        bi_connections_embed: endpoints.development.api.biData + CONNECTIONS_PATH,
        bi_datasets: endpoints.development.api.biData + DATASETS_PATH,
        bi_datasets_embed: endpoints.development.api.biData + DATASETS_PATH,
        us: endpoints.development.api.us,
    },
    production: {
        bi: endpoints.production.api.biData,
        bi_connections: endpoints.production.api.biData + CONNECTIONS_PATH,
        bi_connections_embed: endpoints.production.api.biData + CONNECTIONS_PATH,
        bi_datasets: endpoints.production.api.biData + DATASETS_PATH,
        bi_datasets_embed: endpoints.production.api.biData + DATASETS_PATH,
        us: endpoints.production.api.us,
    },
};
