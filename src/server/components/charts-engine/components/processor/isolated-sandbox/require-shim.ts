declare const __modules: Record<string, any>;

// Libraries provided from the server bundle (see bundled-libs.ts) and resolved at runtime
// by requireShim below. They are NOT stored in US, so dependency pre-resolution must skip
// fetching them (keep this list in sync with the literal names inside requireShim).
export const BUNDLED_LIBS_NAMES = [
    'libs/datalens/v3',
    'libs/control/v1',
    'libs/qlchart/v1',
    'libs/dataset/v2',
];

export const requireShim = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName === 'libs/datalens/v3') {
        return __modules['bundledLibraries']['dist'].datalensModule;
    } else if (lowerName === 'libs/control/v1') {
        return __modules['bundledLibraries']['dist'].controlModule;
    } else if (lowerName === 'libs/qlchart/v1') {
        return __modules['bundledLibraries']['dist'].qlModule;
    } else if (lowerName === 'libs/dataset/v2') {
        return __modules['bundledLibraries']['dist'].datasetModule;
    } else if (__modules[lowerName]) {
        return __modules[lowerName];
    } else {
        throw new Error(`Module "${lowerName}" is not resolved`);
    }
};
