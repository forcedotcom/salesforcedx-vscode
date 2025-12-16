/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SFDX_CORE_CONFIGURATION_NAME } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';

export const retrieveTestCodeCoverage = (): boolean =>
  vscode.workspace.getConfiguration(SFDX_CORE_CONFIGURATION_NAME).get<boolean>('retrieve-test-code-coverage', false);

export const retrieveTestRunConcise = (): boolean =>
  vscode.workspace.getConfiguration('salesforcedx-vscode-apex-testing').get<boolean>('test-run-concise', false);
