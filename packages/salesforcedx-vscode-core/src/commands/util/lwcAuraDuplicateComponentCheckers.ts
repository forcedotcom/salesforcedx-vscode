/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  getMessageFromError,
  notificationService,
  PostconditionChecker,
  readDirectory
} from '@salesforce/salesforcedx-utils-vscode';
import { nls } from '../../messages';
import { ContinueOrCancel, getComponentPath, isContinue, OneOrMany } from '../../util';
import { isComponentName } from '../../util/types';
import { checkForDuplicateInComponent, checkForDuplicateName } from './lwcAuraDuplicateDetectionUtils';

/*
 * Checks for existing component name between LWC and Aura during rename
 */
export class LwcAuraDuplicateComponentCheckerForRename implements PostconditionChecker<OneOrMany> {
  constructor(private readonly sourceFsPath: string) {}
  public async check(inputs: ContinueOrCancel): Promise<ContinueOrCancel> {
    if (!isContinue(inputs)) {
      return inputs;
    }
    if (Array.isArray(inputs.data)) {
      return { type: 'CANCEL', msg: nls.localize('rename_not_supported') };
    }
    const { data } = inputs;
    if (!isComponentName(data)) {
      return { type: 'CANCEL', msg: nls.localize('input_no_component_name') };
    }
    const { name } = data;
    if (!name) {
      return { type: 'CANCEL', msg: nls.localize('component_empty') };
    }

    try {
      const componentPath = await getComponentPath(this.sourceFsPath);
      await checkForDuplicateName(componentPath, name);
      const items = await readDirectory(componentPath);
      await checkForDuplicateInComponent(componentPath, name, items);
      return { type: 'CONTINUE', data: inputs.data };
    } catch (error) {
      const errorMsg = getMessageFromError(error);
      void notificationService.showErrorMessage(errorMsg);
      return { type: 'CANCEL', msg: errorMsg };
    }
  }
}

