/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

export function retrieveTestCodeCoverage(): boolean {
  return vscode.workspace
    .getConfiguration('salesforcedx-vscode-core')
    .get<boolean>('retrieve-test-code-coverage', false);
}
