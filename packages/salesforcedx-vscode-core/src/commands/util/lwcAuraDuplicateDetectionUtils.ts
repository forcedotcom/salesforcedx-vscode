/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { nls } from '../../messages';
import { AURA, isLwcComponent, LWC, TEST_FOLDER } from '../../util/componentUtils';
import { isLwcComponentPath } from '../../util/types';

export const RENAME_LIGHTNING_COMPONENT_EXECUTOR = 'rename_lightning_component';
export const RENAME_INPUT_PLACEHOLDER = 'rename_component_input_placeholder';
export const RENAME_INPUT_PROMPT = 'rename_component_input_prompt';
export const INPUT_DUP_ERROR = 'component_input_dup_error';
export const RENAME_INPUT_DUP_FILE_NAME_ERROR = 'rename_component_input_dup_file_name_error';
export const RENAME_ERROR = 'rename_component_error';
export const RENAME_WARNING = 'rename_component_warning';

export const RENAME_NOT_SUPPORTED_MESSAGE = 'rename_not_supported';
export const INPUT_NO_COMPONENT_NAME_MESSAGE = 'input_no_component_name';
export const COMPONENT_CANNOT_BE_EMPTY_MESSAGE = 'component_empty';
export const CREATE_NOT_SUPPORTED_MESSAGE = 'create_not_supported';
export const INPUT_INCORRECT_COMPONENT_PROPERTIES_MESSAGE = 'input_incorrect_properties';

/**
 * check duplicate name under current component directory and __tests__ directory to avoid file loss
 */
export const checkForDuplicateInComponent = async (componentPath: string, newName: string, items: string[]) => {
  let allFiles = items;
  if (items.includes(TEST_FOLDER)) {
    const testFiles = await fs.readdir(path.join(componentPath, TEST_FOLDER));
    allFiles = items.concat(testFiles);
  }
  const allFileNames = getOnlyFileNames(allFiles);
  if (allFileNames.includes(newName)) {
    throw new Error(nls.localize(RENAME_INPUT_DUP_FILE_NAME_ERROR));
  }
};

export const isNameMatch = (item: string, componentName: string, componentPath: string): boolean => {
  const isLwc = isLwcComponent(componentPath);
  const regularExp = isLwc
    ? new RegExp(`${componentName}\\.(html|js|js-meta.xml|css|svg|test.js)`)
    : new RegExp(`${componentName}(((Controller|Renderer|Helper)?\\.js)|(\\.(cmp|app|css|design|auradoc|svg|evt)))`);
  return Boolean(item.match(regularExp));
};
/**
 * Component names for LWC and Aura connot have the same name
 * Given a componentPath and name for LWC or Aura, check the opposing folder to see if the same name is being used
 * if not be used return true, otherwise throw an error
 * @param componentPath
 * @param name
 * @returns
 */
export const checkForExistingComponentInAltLocation = (componentPath: string, name: string): Promise<boolean> => {
  let pathToCheck;
  if (isLwcComponentPath(componentPath)) {
    pathToCheck = path.join(path.dirname(componentPath), AURA);
  } else {
    pathToCheck = path.join(path.dirname(componentPath), LWC);
  }

  if (pathToCheck) {
    return fs
      .stat(path.join(pathToCheck, name))
      .then(() => true) // Component exists
      .catch(() => false); // Component does not exist
  }

  return Promise.resolve(false); // No path to check
};

export const checkForDuplicateName = async (componentPath: string, newName: string) => {
  const isNameDuplicate = await isDuplicate(componentPath, newName);
  if (isNameDuplicate) {
    throw new Error(nls.localize(INPUT_DUP_ERROR));
  }
};

export const getOnlyFileNames = (allFiles: string[]) => {
  return allFiles.map(file => {
    const split = file?.split('.');
    return split?.length > 1 ? split[0] : '';
  });
};

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

const readFromDir = (dirPath: string): Promise<string[]> => {
  return fs
    .readdir(dirPath)
    .then(files => files)
    .catch(() => {
      return [];
    });
};

// for testing
export const lwcAuraDuplicateComponentCheckersTesting = {
  checkForDuplicateName,
  checkForDuplicateInComponent,
  isNameMatch
};
