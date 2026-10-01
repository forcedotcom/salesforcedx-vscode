/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const filesDir = path.join(__dirname, 'files');

const readFile = (filename: string): string => fs.readFileSync(path.join(filesDir, filename), 'utf8');

export const getIdealCaseManagerOASDoc = (): string => readFile('idealCaseManagerOASDoc.xml');

export const getSfdxProjectJson = (): string => {
  const project = JSON.parse(readFile('sfdxProject.json'));
  return JSON.stringify(project, null, 2);
};

export const getIdealSimpleAccountResourceYaml = (): string => readFile('idealSimpleAccountResource.yaml');

export const getIdealSimpleAccountResourceXml = (): string => readFile('idealSimpleAccountResource.xml');
