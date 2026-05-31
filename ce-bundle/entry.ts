import {
    controlModule,
    datalensModule,
    datasetModule,
    qlModule,
} from '../src/server/components/charts-engine/components/processor/isolated-sandbox/interop/bundled-libs';

// requireShim (require-shim.ts) resolves libs/* to __modules['bundledLibraries']['dist'].<module>.
// processModule wraps this file as `var module={exports:{}}; <code>; __modules['bundledLibraries']=module.exports`.
module.exports = {dist: {datasetModule, controlModule, datalensModule, qlModule}};
