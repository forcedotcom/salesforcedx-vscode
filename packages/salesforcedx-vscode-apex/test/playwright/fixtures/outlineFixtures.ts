/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopTest } from '@salesforce/playwright-vscode-ext';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const EXAMPLE_CLASS = [
  'public with sharing class ExampleClass {',
  '\tpublic static String SayHello(String name) {',
  "\t\treturn 'Hello, ' + name + '!';",
  '\t}',
  '}'
].join('\n');

const EXAMPLE_CLASS_META = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">',
  '\t<apiVersion>64.0</apiVersion>',
  '\t<status>Active</status>',
  '</ApexClass>'
].join('\n');

// Outline specs exercise the external TS Apex LS (salesforce.apex-language-server-extension).
// skipCurrentPackage: true prevents loading the jorje-based extension from this package.
const baseTest = createDesktopTest({
  fixturesDir: __dirname,
  skipCurrentPackage: true,
  marketplaceExtensionIds: ['salesforce.apex-language-server-extension'],
  disableOtherExtensions: false
});

// Override `workspaceDir` to seed ExampleClass.cls before Electron launches.
export const outlineTest = baseTest.extend<{ workspaceDir: string }>({
  workspaceDir: async ({ workspaceDir }, use) => {
    const classesDir = path.join(workspaceDir, 'force-app', 'main', 'default', 'classes');
    await fs.mkdir(classesDir, { recursive: true });
    await Promise.all([
      fs.writeFile(path.join(classesDir, 'ExampleClass.cls'), EXAMPLE_CLASS),
      fs.writeFile(path.join(classesDir, 'ExampleClass.cls-meta.xml'), EXAMPLE_CLASS_META)
    ]);
    await use(workspaceDir);
  }
});
