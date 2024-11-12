/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getMessageFromError, notificationService, PostconditionChecker } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
import { nls } from '../../messages';
import { ContinueOrCancel, getComponentName, getComponentPath, isContinue, OneOrMany } from '../../util';
import { isComponentName, isDirFileNameSelection } from '../../util/types';
import {
  RENAME_NOT_SUPPORTED_MESSAGE,
  INPUT_NO_COMPONENT_NAME_MESSAGE,
  COMPONENT_CANNOT_BE_EMPTY_MESSAGE,
  CREATE_NOT_SUPPORTED_MESSAGE,
  INPUT_INCORRECT_COMPONENT_PROPERTIES_MESSAGE,
  INPUT_DUP_ERROR,
  checkForExistingComponentInAltLocation,
  checkForDuplicateInComponent,
  checkForDuplicateName
} from './lwcAuraDuplicateDetectionUtils';

/*
 * Checks for existing component name between LWC and Aura during rename
 */
export class LwcAuraDuplicateComponentCheckerForRename implements PostconditionChecker<OneOrMany> {
  constructor(private readonly sourceFsPath: string) {}
  async check(inputs: ContinueOrCancel): Promise<ContinueOrCancel> {
    if (!isContinue(inputs)) {
      return Promise.resolve(inputs);
    }
    if (Array.isArray(inputs.data)) {
      return { type: 'CANCEL', msg: nls.localize(RENAME_NOT_SUPPORTED_MESSAGE) };
    }
    const { data } = inputs;
    if (!isComponentName(data)) {
      return { type: 'CANCEL', msg: nls.localize(INPUT_NO_COMPONENT_NAME_MESSAGE) };
    }
    const { name } = data;
    if (!name) {
      return { type: 'CANCEL', msg: nls.localize(COMPONENT_CANNOT_BE_EMPTY_MESSAGE) };
    }

    try {
      const componentPath = await getComponentPath(this.sourceFsPath);
      await checkForDuplicateName(componentPath, name);
      const items = await fs.promises.readdir(componentPath);
      await checkForDuplicateInComponent(componentPath, name, items);
      return { type: 'CONTINUE', data: inputs.data };
    } catch (error) {
      const errorMsg = getMessageFromError(error);
      void notificationService.showErrorMessage(errorMsg);
      return { type: 'CANCEL', msg: errorMsg };
    }
  }
}

/**
 * Checks for existing component name between LWC and Aura during create
 */
export class LwcAuraDuplicateComponentCheckerForCreate implements PostconditionChecker<OneOrMany> {
  constructor() {}
  async check(inputs: ContinueOrCancel): Promise<ContinueOrCancel> {
    if (!isContinue(inputs)) {
      return Promise.resolve(inputs);
    }
    if (Array.isArray(inputs.data)) {
      return { type: 'CANCEL', msg: nls.localize(CREATE_NOT_SUPPORTED_MESSAGE) };
    }

    if (!isDirFileNameSelection(inputs.data)) {
      return { type: 'CANCEL', msg: nls.localize(INPUT_INCORRECT_COMPONENT_PROPERTIES_MESSAGE) };
    }

    const componentPath = inputs.data.outputdir;
    const componentName = getComponentName(inputs.data.fileName);
    return checkForExistingComponentInAltLocation(componentPath, componentName).then(exists => {
      if (exists) {
        void notificationService.showErrorMessage(nls.localize(INPUT_DUP_ERROR));
        return { type: 'CANCEL', msg: nls.localize(INPUT_DUP_ERROR) };
      }
      // No duplicates found, continue with the process
      return { type: 'CONTINUE', data: inputs.data };
    });
  }
}
