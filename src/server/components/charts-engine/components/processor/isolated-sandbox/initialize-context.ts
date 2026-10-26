import type ivm from 'isolated-vm';

/** Copy configuration as data: interpolating JSON into JavaScript changes escapes and quotes. */
export function initializeSandboxContext(context: ivm.Context, values: Record<string, unknown>) {
    for (const [name, value] of Object.entries(values)) {
        context.global.setSync(name, value, {copy: true});
    }

    context.evalSync(`
        Math.E = ${Math.E};
        const __modules = {};
        let __params;
        let __usedParams;
        let __runtimeMetadata = {userParamsOverride: undefined};
    `);
}
