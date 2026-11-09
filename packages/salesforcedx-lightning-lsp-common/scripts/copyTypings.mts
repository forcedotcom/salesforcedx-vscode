#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import findNodeModules from 'find-node-modules';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
// the copied files are added to the user's .sfdx/typings

// copy engine.d.ts file from node_modules
const destDir = resolve(join(import.meta.dirname, '..', 'src', 'resources', 'sfdx', 'typings', 'copied'));

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
        fs.copyFileSync(inputFile, join(destDir, `${pkg}.d.ts`));
      }
    }
  }
}
