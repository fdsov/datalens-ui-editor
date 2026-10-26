import fs from 'fs';

import ivm from 'isolated-vm';

import {initializeSandboxContext} from './initialize-context';
import {requireShim} from './require-shim';

test('loads bundled dataset helpers inside the editor isolate', () => {
    const isolate = new ivm.Isolate({memoryLimit: 128});
    const context = isolate.createContextSync();
    const code = fs.readFileSync('ce-dist/bundled-libs.js', 'utf-8');
    try {
        initializeSandboxContext(context, {});
        context.evalClosureSync(
            `var module = {exports: {}};\n${code}\n__modules.bundledLibraries = module.exports;`,
            [],
            {timeout: 500},
        );
        const source = context.evalClosureSync(
            `const require = ${requireShim.toString()};
             return require('libs/dataset/v2').buildSource({id: 'dataset-id', columns: ['value']});`,
            [],
            {timeout: 500, result: {copy: true}},
        );
        expect(source).toMatchObject({
            datasetId: 'dataset-id',
            path: 'result',
            data: {fields: [{ref: {type: 'title', title: 'value'}, block_id: 0}]},
        });
    } finally {
        context.release();
        isolate.dispose();
    }
});
