#!/usr/bin/env node
const fs = require('fs');
const { join, resolve } = require('path');
const findNodeModules = require('find-node-modules');
// the copied files are added to the user's .sfdx/typings

// copy engine.d.ts file from node_modules
const destDir = resolve(join(__dirname, '..', 'src', 'resources', 'sfdx', 'typings', 'copied'));

// Ensure destination directory exists
fs.mkdirSync(destDir, { recursive: true });

//Copying the engine.d.ts from new npm package, letting the same name
fs.copyFileSync(join(require.resolve('lwc'), '..', 'types.d.ts'), join(destDir, 'engine.d.ts'));

const modules = findNodeModules();
// copy @salesforce typings from node_modules
for (const mod of modules) {
    const salesforce = join(mod, '@salesforce');
    if (fs.existsSync(salesforce)) {
        for (const pkg of fs.readdirSync(salesforce)) {
            const inputFile = join(salesforce, pkg, 'dist', 'types', 'index.d.ts');
            if (fs.existsSync(inputFile)) {
                fs.copyFileSync(inputFile, join(destDir, pkg + '.d.ts'));
            }
        }
    }
}
