/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';

export type CommandletExecutor<T> = {
  execute(response: ContinueResponse<T>): void;
  readonly onDidFinishExecution?: vscode.Event<[number, number]>;
};
