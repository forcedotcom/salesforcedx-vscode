/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SFDX_CORE_CONFIGURATION_NAME } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';

export const retrieveTestCodeCoverage = (): boolean => {
  return vscode.workspace
    .getConfiguration(SFDX_CORE_CONFIGURATION_NAME)
    .get<boolean>('retrieve-test-code-coverage', false);
};
