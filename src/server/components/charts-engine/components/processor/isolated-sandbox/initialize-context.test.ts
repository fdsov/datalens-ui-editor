import ivm from 'isolated-vm';

import {initializeSandboxContext} from './initialize-context';

describe('Chart Editor sandbox configuration', () => {
    test('preserves quotes, backslashes, newlines and Unicode as data', () => {
        const isolate = new ivm.Isolate({memoryLimit: 16});
        const context = isolate.createContextSync();
        const values = {
            __links: {
                "owner's dataset": 'entry-1',
                'literal\\nname': 'entry-2',
                'line\nbreak': 'entry-3',
                'Данные 🌍': 'entry-4',
                "'); globalThis.injected = true; //": 'entry-5',
            },
            __palettes: {custom: {name: "Owner's palette", colors: ['#fff']}},
            __features: {enabled: true},
            __qlConnectionTypeMap: {connection: 'postgres'},
        };

        try {
            initializeSandboxContext(context, values);
            for (const [name, value] of Object.entries(values)) {
                expect(context.global.getSync(name, {copy: true})).toEqual(value);
            }
            expect(context.evalSync('typeof injected')).toBe('undefined');
            expect(context.evalSync('Object.keys(__modules).length')).toBe(0);
            // The isolate must not retain references to host configuration objects.
            context.evalSync('__features.enabled = false');
            expect(values.__features.enabled).toBe(true);
        } finally {
            context.release();
            isolate.dispose();
        }
    });
});
