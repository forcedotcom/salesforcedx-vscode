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

// Anonymous Apex (`.apex`, language `apex-anon`). No class wrapper, no `-meta.xml`.
// Layout is load-bearing: spec navigates to line 2 (blank) and types autocompletion content
// there — keep line 2 blank.
const EXAMPLE_ANON = ["System.debug('seed');", ''].join('\n');

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

// Shared userSettings: apexLsp specs do not exercise Push/Pull, so the workspace has no org.
const userSettings = {
  'git.terminalAuthentication': false,
  'git.autofetch': false,
  // Prevent Go to Definition from opening a peek widget when the target file is already open
  'editor.gotoLocation.multipleDefinitions': 'goto',
  'editor.gotoLocation.multipleDeclarations': 'goto',
  'editor.gotoLocation.multipleImplementations': 'goto',
  'editor.gotoLocation.multipleTypeDefinitions': 'goto',
  'editor.gotoLocation.multipleReferences': 'goto',
  'editor.gotoLocation.alternativeDefinitionCommand': ''
};

// Files are pre-seeded onto disk before Electron launches so the jorje LSP startup scan picks
// them up.
const baseTest = createDesktopTest({
  fixturesDir: __dirname,
  additionalExtensionDirs: ['salesforcedx-vscode-core'],
  disableOtherExtensions: false,
  userSettings
});

// Snippet spec needs the marketplace ext `salesforce.apex-language-server-extension` (ships
// apex.json snippets). `marketplaceExtensions` is a createDesktopTest arg, not extendable
// per-test — so this is its own createDesktopTest. `disableOtherExtensions: false` is required:
// the default `--disable-extensions` would block the marketplace ext from loading.
const snippetBaseTest = createDesktopTest({
  fixturesDir: __dirname,
  additionalExtensionDirs: ['salesforcedx-vscode-core'],
  marketplaceExtensions: ['salesforce.apex-language-server-extension'],
  disableOtherExtensions: false,
  userSettings
});

// Override `workspaceDir` so files land on disk before Electron is launched (which depends on
// workspaceDir). jorje scans the project at startup; files written after launch require a window
// reload. Shared by both tests so the seeded files (incl. ExampleClassTest.cls blank line 7) match.
const seedWorkspaceFiles = {
  workspaceDir: async ({ workspaceDir }: { workspaceDir: string }, use: (r: string) => Promise<void>) => {
    const classesDir = path.join(workspaceDir, 'force-app', 'main', 'default', 'classes');
    // Anonymous Apex lives at workspace-root `scripts/apex/` (Salesforce convention; the dir
    // templates scaffold). Not metadata — no `classes/` placement, no `-meta.xml`. jorje's
    // startup scan picks it up (scripts is not an excluded metadata folder).
    const anonDir = path.join(workspaceDir, 'scripts', 'apex');
    await Promise.all([fs.mkdir(classesDir, { recursive: true }), fs.mkdir(anonDir, { recursive: true })]);
    await Promise.all([
      fs.writeFile(path.join(classesDir, 'ExampleClass.cls'), EXAMPLE_CLASS),
      fs.writeFile(path.join(classesDir, 'ExampleClass.cls-meta.xml'), EXAMPLE_CLASS_META),
      fs.writeFile(path.join(classesDir, 'ExampleClassTest.cls'), EXAMPLE_CLASS_TEST),
      fs.writeFile(path.join(classesDir, 'ExampleClassTest.cls-meta.xml'), EXAMPLE_CLASS_META),
      fs.writeFile(path.join(anonDir, 'ExampleAnon.apex'), EXAMPLE_ANON)
    ]);
    await use(workspaceDir);
  }
};

export const desktopTest = baseTest.extend<{ workspaceDir: string }>(seedWorkspaceFiles);

export const snippetDesktopTest = snippetBaseTest.extend<{ workspaceDir: string }>(seedWorkspaceFiles);
