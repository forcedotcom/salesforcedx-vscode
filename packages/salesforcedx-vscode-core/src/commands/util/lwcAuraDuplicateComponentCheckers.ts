/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { notificationService, PostconditionChecker } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as path from 'path';
import { nls } from '../../messages';
import { AURA, ContinueOrCancel, getComponentName, getComponentPath, isContinue, isLwcComponent, LWC, OneOrMany, TEST_FOLDER } from '../../util';
import { isComponentName, isDirFileNameSelection, isLwcComponentPath } from '../../util/types';

export const RENAME_LIGHTNING_COMPONENT_EXECUTOR = 'rename_lightning_component';
export const RENAME_INPUT_PLACEHOLDER = 'rename_component_input_placeholder';
export const RENAME_INPUT_PROMPT = 'rename_component_input_prompt';
export const INPUT_DUP_ERROR = 'component_input_dup_error';
export const RENAME_INPUT_DUP_FILE_NAME_ERROR =
  'rename_component_input_dup_file_name_error';
export const RENAME_ERROR = 'rename_component_error';
export const RENAME_WARNING = 'rename_component_warning';

const RENAME_NOT_SUPPORTED_MESSAGE = 'rename_not_supported';
const INPUT_NO_COMPONENT_NAME_MESSAGE = 'input_no_component_name';
const COMPONENT_CANNOT_BE_EMPTY_MESSAGE = 'component_empty';
const CREATE_NOT_SUPPORTED_MESSAGE = 'create_not_supported';
const INPUT_INCORRECT_COMPONENT_PROPERTIES_MESSAGE = 'input_incorrect_properties';

/*
 * Checks for existing component name between LWC and Aura during rename
 */
export class LwcAuraDuplicateComponentCheckerForRename implements PostconditionChecker<OneOrMany> {
  constructor(private readonly sourceFsPath: string) { }
  async check(inputs: ContinueOrCancel): Promise<ContinueOrCancel> {
    if (!isContinue(inputs)) {
      return Promise.resolve(inputs);
    }
    if (Array.isArray(inputs.data)) {
      // TODO: add to nls
      return { type: 'CANCEL', msg: nls.localize(RENAME_NOT_SUPPORTED_MESSAGE) };
    }
    const { data } = inputs;
    if (!isComponentName(data)) {
      // TODO: add to nls
      return { type: 'CANCEL', msg: nls.localize(INPUT_NO_COMPONENT_NAME_MESSAGE) };
    }
    const { name } = data;
    if (!name) {
      // TODO: add to nls
      return { type: 'CANCEL', msg: nls.localize(COMPONENT_CANNOT_BE_EMPTY_MESSAGE) };
    }

    const componentPath = await getComponentPath(this.sourceFsPath);
    await checkForDuplicateName(componentPath, name);
    const items = await fs.promises.readdir(componentPath);
    await checkForDuplicateInComponent(componentPath, name, items);
    // check for dups here
    return { type: 'CONTINUE', data: inputs.data };
  }
}

/**
 * Checks for existing component name between LWC and Aura during create
 */
export class LwcAuraDuplicateComponentCheckerForCreate implements PostconditionChecker<OneOrMany> {
  constructor() { }
  async check(inputs: ContinueOrCancel): Promise<ContinueOrCancel> {
    if (!isContinue(inputs)) {
      return Promise.resolve(inputs);
    }
    if (Array.isArray(inputs.data)) {
      // TODO: add to nls
      return { type: 'CANCEL', msg: nls.localize(CREATE_NOT_SUPPORTED_MESSAGE) };
    }

    if (!isDirFileNameSelection(inputs.data)) {
      // TODO: add to nls
      return { type: 'CANCEL', msg: nls.localize(INPUT_INCORRECT_COMPONENT_PROPERTIES_MESSAGE) };
    }

    const componentPath = inputs.data.outputdir;
    const componentName = getComponentName(inputs.data.fileName);
    return checkForExistingComponentInAltLocation(componentPath, componentName)
      .then(exists => {
        if (exists) {
          void notificationService.showErrorMessage(nls.localize(INPUT_DUP_ERROR));
          return { type: 'CANCEL', msg: nls.localize(INPUT_DUP_ERROR) };
        }
        // No duplicates found, continue with the process
        return { type: 'CONTINUE', data: inputs.data };
      });
  }
}

/**
 * Component names for LWC and Aura connot have the same name
 * Given a componentPath and name for LWC or Aura, check the opposing folder to see if the same name is being used
 * if not be used return true, otherwise throw an error
 * @param componentPath
 * @param name
 * @returns
 */
const checkForExistingComponentInAltLocation = (
  componentPath: string,
  name: string
): Promise<boolean> => {
  let pathToCheck;
  if (isLwcComponentPath(componentPath)) {
    pathToCheck = path.join(path.dirname(componentPath), AURA);
  } else {
    pathToCheck = path.join(path.dirname(componentPath), LWC);
  }

  if (pathToCheck) {
    return fs.promises
      .stat(path.join(pathToCheck, name))
      .then(() => true) // Component exists
      .catch(() => false); // Component does not exist
  }

  return Promise.resolve(false); // No path to check
};

export const checkForDuplicateName = async (
  componentPath: string,
  newName: string
) => {
  const isNameDuplicate = await isDuplicate(componentPath, newName);
  if (isNameDuplicate) {
    const errorMessage = nls.localize(INPUT_DUP_ERROR);
    void notificationService.showErrorMessage(errorMessage);
    throw new Error(errorMessage);
  }
};

const isDuplicate = async (
  componentPath: string,
  newName: string
): Promise<boolean> => {
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
  return (
    allLwcComponents.includes(newName) || allAuraComponents.includes(newName)
  );
};

const readFromDir = (
  dirPath: string
): Promise<string[]> => {
  return fs.promises.readdir(dirPath)
    .then(files => files)
    .catch(() => { return []; });
};

/**
 * check duplicate name under current component directory and __tests__ directory to avoid file loss
 */
export const checkForDuplicateInComponent = async (
  componentPath: string,
  newName: string,
  items: string[]
) => {
  let allFiles = items;
  if (items.includes(TEST_FOLDER)) {
    const testFiles = await fs.promises.readdir(
      path.join(componentPath, TEST_FOLDER)
    );
    allFiles = items.concat(testFiles);
  }
  const allFileNames = getOnlyFileNames(allFiles);
  if (allFileNames.includes(newName)) {
    const errorMessage = nls.localize(RENAME_INPUT_DUP_FILE_NAME_ERROR);
    void notificationService.showErrorMessage(errorMessage);
    throw new Error(errorMessage);
  }
};

const getOnlyFileNames = (allFiles: string[]) => {
  return allFiles.map(file => {
    const split = file?.split('.');
    return split?.length > 1 ? split[0] : '';
  });
};

export const isNameMatch = (
  item: string,
  componentName: string,
  componentPath: string
): boolean => {
  const isLwc = isLwcComponent(componentPath);
  const regularExp = isLwc
    ? new RegExp(`${componentName}\\.(html|js|js-meta.xml|css|svg|test.js)`)
    : new RegExp(
      `${componentName}(((Controller|Renderer|Helper)?\\.js)|(\\.(cmp|app|css|design|auradoc|svg|evt)))`
    );
  return Boolean(item.match(regularExp));
};

// for testing
export const lwcAuraDuplicateComponentCheckersTesting = {
  checkForDuplicateName,
  checkForDuplicateInComponent,
  isNameMatch
};
