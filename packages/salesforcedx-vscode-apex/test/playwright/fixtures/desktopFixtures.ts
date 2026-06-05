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
  '\tpublic static String SayHello(String name){',
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

// Layout is load-bearing: spec navigates to 5:20 for Go to Definition (lands inside
// `ExampleClass`) and types autocompletion content into the blank line 7 — keep line 7 blank.
const EXAMPLE_CLASS_TEST = [
  '@IsTest',
  'public class ExampleClassTest {',
  '\t@IsTest',
  '\tstatic void validateSayHello() {',
  "\t\tString result = ExampleClass.SayHello('Cody');",
  "\t\tSystem.assertEquals('Hello, Cody!', result, 'SayHello should greet the name');",
  '',
  '\t}',
  '}'
].join('\n');

// apexLsp specs do not exercise Push/Pull, so the workspace has no org. Files are pre-seeded
// onto disk before Electron launches so the jorje LSP startup scan picks them up — drops the
// WDIO Windows-only `reloadWindow` workaround.
const baseTest = createDesktopTest({
  fixturesDir: __dirname,
  additionalExtensionDirs: ['salesforcedx-vscode-core'],
  disableOtherExtensions: false,
  userSettings: {
    'git.terminalAuthentication': false,
    'git.autofetch': false
  }
});

// Override `workspaceDir` so ExampleClass.cls + ExampleClassTest.cls land on disk before
// Electron is launched (which depends on workspaceDir). jorje scans the project at startup;
// files written after launch require a window reload.
export const desktopTest = baseTest.extend<{ workspaceDir: string }>({
  workspaceDir: async ({ workspaceDir }, use) => {
    const classesDir = path.join(workspaceDir, 'force-app', 'main', 'default', 'classes');
    await fs.mkdir(classesDir, { recursive: true });
    await Promise.all([
      fs.writeFile(path.join(classesDir, 'ExampleClass.cls'), EXAMPLE_CLASS),
      fs.writeFile(path.join(classesDir, 'ExampleClass.cls-meta.xml'), EXAMPLE_CLASS_META),
      fs.writeFile(path.join(classesDir, 'ExampleClassTest.cls'), EXAMPLE_CLASS_TEST),
      fs.writeFile(path.join(classesDir, 'ExampleClassTest.cls-meta.xml'), EXAMPLE_CLASS_META)
    ]);
    await use(workspaceDir);
  }
});
