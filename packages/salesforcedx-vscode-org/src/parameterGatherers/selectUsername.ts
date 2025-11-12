/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { CancelResponse, ContinueResponse, ParametersGatherer } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { nls } from '../messages';

/** Prompts the user to enter a username */
export class SelectUsername implements ParametersGatherer<{ username: string }> {
  public async gather(): Promise<CancelResponse | ContinueResponse<{ username: string }>> {
    const usernameInputOptions: vscode.InputBoxOptions = {
      prompt: nls.localize('parameter_gatherer_enter_username_name')
    } satisfies vscode.InputBoxOptions;
    const username = await vscode.window.showInputBox(usernameInputOptions);
    return username ? { type: 'CONTINUE', data: { username } } : { type: 'CANCEL' };
  }
}
