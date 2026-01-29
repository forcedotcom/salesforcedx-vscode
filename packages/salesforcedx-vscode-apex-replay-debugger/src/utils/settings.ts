/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

const APEX_TESTING_CONFIGURATION_NAME = 'salesforcedx-vscode-apex-testing';

export const retrieveTestCodeCoverage = (): boolean =>
  vscode.workspace.getConfiguration(APEX_TESTING_CONFIGURATION_NAME).get<boolean>('retrieve-test-code-coverage', false);
