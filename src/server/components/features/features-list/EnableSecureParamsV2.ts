import {Feature} from '../../../../shared';
import {createFeatureConfig} from '../utils';

export default createFeatureConfig({
    name: Feature.EnableSecureParamsV2,
    state: {
        // Parameters signed in the embedding token must always win over the incoming ones,
        // otherwise a viewer can override their own row-level filter through the query string.
        development: true,
        production: true,
    },
});
