/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SFDX_LWC_EXTENSION_NAME } from '@salesforce/salesforcedx-utils-vscode';

export const ESLINT_NODEPATH_CONFIG = 'eslint.nodePath';
export const VSCODE_LWC_EXTENSION_NAME = `salesforce.${SFDX_LWC_EXTENSION_NAME}`;

export const log = (message: string) => {
  console.log(message);
};
