#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import findNodeModules from 'find-node-modules';
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
// The copied files are added to the user's .sfdx/typings.
const destDir = resolve(join(import.meta.dirname, '..', 'src', 'resources', 'sfdx', 'typings', 'copied'));

// Ensure destination directory exists.
mkdirSync(destDir, { recursive: true });

// Copy engine.d.ts from the LWC package, keeping the expected name.
copyFileSync(join(require.resolve('lwc'), '..', 'types.d.ts'), join(destDir, 'engine.d.ts'));

// Copy @salesforce typings from node_modules.
for (const modulePath of findNodeModules()) {
  const salesforcePath = join(modulePath, '@salesforce');
  if (existsSync(salesforcePath)) {
    for (const packageName of readdirSync(salesforcePath)) {
      const inputFile = join(salesforcePath, packageName, 'dist', 'types', 'index.d.ts');
      if (existsSync(inputFile)) {
        copyFileSync(inputFile, join(destDir, `${packageName}.d.ts`));
      }
    }
  }
}

// Copy src/resources into out/src/.
cpSync('src/resources', join('out', 'src', 'resources'), { recursive: true });
