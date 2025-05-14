/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const readJsonFile = (filename: string): unknown => {
  const filePath = path.join(__dirname, filename);
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
};

const readXmlFile = (filename: string): string => {
  const filePath = path.join(__dirname, filename);
  return fs.readFileSync(filePath, 'utf8');
};

const readYamlFile = (filename: string): string => {
  const filePath = path.join(__dirname, filename);
  return fs.readFileSync(filePath, 'utf8');
};

export const getIdealCaseManagerOASDoc = (): string => readXmlFile('./files/idealCaseManagerOASDoc.xml');

export const getSfdxProjectJson = (): string => {
  const project = readJsonFile('sfdxProject.json');
  return JSON.stringify(project, null, 2);
};

export const getIdealSimpleAccountResourceYaml = (): string => readYamlFile('./files/idealSimpleAccountResource.yaml');

export const getIdealSimpleAccountResourceXml = (): string => readXmlFile('./files/idealSimpleAccountResource.xml');
