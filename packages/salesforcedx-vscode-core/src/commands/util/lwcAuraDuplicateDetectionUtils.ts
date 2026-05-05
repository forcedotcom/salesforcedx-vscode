/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { readDirectory } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import { nls } from '../../messages';
import { AURA, isLwcComponent, LWC, TEST_FOLDER } from '../../util/componentUtils';

/**
 * check duplicate name under current component directory and __tests__ directory to avoid file loss
 */
export const checkForDuplicateInComponent = async (componentPath: string, newName: string, items: string[]) => {
  let allFiles = items;
  if (items.includes(TEST_FOLDER)) {
    const testFiles = await readDirectory(path.join(componentPath, TEST_FOLDER));
    allFiles = items.concat(testFiles);
  }
  const allFileNames = getOnlyFileNames(allFiles);
  if (allFileNames.includes(newName)) {
    throw new Error(nls.localize('rename_component_input_dup_file_name_error'));
  }
};

export const isNameMatch = (item: string, componentName: string, componentPath: string): boolean => {
  const isLwc = isLwcComponent(componentPath);
  const regularExp = isLwc
    ? new RegExp(`${componentName}\\.(html|js|js-meta.xml|css|svg|test.js)`)
    : new RegExp(`${componentName}(((Controller|Renderer|Helper)?\\.js)|(\\.(cmp|app|css|design|auradoc|svg|evt)))`);
  return Boolean(item.match(regularExp));
};
export const checkForDuplicateName = async (componentPath: string, newName: string) => {
  const isNameDuplicate = await isDuplicate(componentPath, newName);
  if (isNameDuplicate) {
    throw new Error(nls.localize('component_input_dup_error'));
  }
};

const getOnlyFileNames = (allFiles: string[]) =>
  allFiles.map(file => {
    const split = file?.split('.');
    return split?.length > 1 ? split[0] : '';
  });

const isDuplicate = async (componentPath: string, newName: string): Promise<boolean> => {
  // A LWC component can't share the same name as a Aura component
  const componentPathDirName = path.dirname(componentPath);
  let lwcPath: string;
  let auraPath: string;
  if (isLwcComponent(componentPath)) {
    lwcPath = componentPathDirName;
    auraPath = path.join(path.dirname(componentPathDirName), AURA);
  } else {
    lwcPath = path.join(path.dirname(componentPathDirName), LWC);
    auraPath = componentPathDirName;
  }
  const allLwcComponents = await readFromDir(lwcPath);
  const allAuraComponents = await readFromDir(auraPath);
  return allLwcComponents.includes(newName) || allAuraComponents.includes(newName);
};

const readFromDir = async (dirPath: string): Promise<string[]> => {
  try {
    return await readDirectory(dirPath);
  } catch {
    return [];
  }
};
