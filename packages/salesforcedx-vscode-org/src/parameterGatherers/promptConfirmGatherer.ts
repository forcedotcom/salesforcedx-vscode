/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { CancelResponse, ContinueResponse, ParametersGatherer } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';

/** Prompts the user to confirm an action with Continue/Cancel options */
export class PromptConfirmGatherer implements ParametersGatherer<{ choice: string }> {
  private question: string;

  constructor(question: string) {
    this.question = question;
  }

  public async gather(): Promise<CancelResponse | ContinueResponse<{ choice: string }>> {
    const confirmOpt = 'Continue';
    const cancelOpt = 'Cancel';
    const choice = await this.showMenu([cancelOpt, confirmOpt]);
    return confirmOpt === choice ? { type: 'CONTINUE', data: { choice } } : { type: 'CANCEL' };
  }

  public async showMenu(options: string[]): Promise<string | undefined> {
    return await vscode.window.showQuickPick(options, {
      placeHolder: this.question
    } satisfies vscode.QuickPickOptions);
  }
}
