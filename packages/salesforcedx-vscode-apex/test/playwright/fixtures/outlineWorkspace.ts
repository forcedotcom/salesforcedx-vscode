/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

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

/** Turn on the TS Apex LS. Web leaves `apex.loadWorkspace.enabled` off unless set here. */
export const outlineLanguageServerSettings = {
  'apex.enable': true,
  'apex.loadWorkspace': { enabled: true }
};

export const seedOutlineWorkspace = async (workspaceDir: string): Promise<void> => {
  const classesDir = path.join(workspaceDir, 'force-app', 'main', 'default', 'classes');
  const vscodeDir = path.join(workspaceDir, '.vscode');
  await Promise.all([fs.mkdir(classesDir, { recursive: true }), fs.mkdir(vscodeDir, { recursive: true })]);
  await Promise.all([
    fs.writeFile(path.join(classesDir, 'ExampleClass.cls'), EXAMPLE_CLASS),
    fs.writeFile(path.join(classesDir, 'ExampleClass.cls-meta.xml'), EXAMPLE_CLASS_META),
    fs.writeFile(
      path.join(vscodeDir, 'settings.json'),
      `${JSON.stringify(outlineLanguageServerSettings, null, 2)}\n`
    )
  ]);
};
