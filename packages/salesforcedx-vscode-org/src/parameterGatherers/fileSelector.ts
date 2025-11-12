/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { CancelResponse, ContinueResponse, ParametersGatherer } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import * as vscode from 'vscode';

export type FileSelection = { file: string };

/** Allows users to select a file matching a glob pattern */
export class FileSelector implements ParametersGatherer<FileSelection> {
  private readonly displayMessage: string;
  private readonly errorMessage: string;
  private readonly include: string;

  constructor(displayMessage: string, errorMessage: string, include: string) {
    this.displayMessage = displayMessage;
    this.errorMessage = errorMessage;
    this.include = include;
  }

  public async gather(): Promise<CancelResponse | ContinueResponse<FileSelection>> {
    const files = await vscode.workspace.findFiles(this.include);
    const fileItems = files.map(file => ({
      label: path.basename(file.toString()),
      description: file.fsPath
    }));
    if (fileItems.length === 0) {
      vscode.window.showErrorMessage(this.errorMessage);
      return { type: 'CANCEL' };
    }
    const selection = await vscode.window.showQuickPick(fileItems, {
      placeHolder: this.displayMessage
    });
    return selection ? { type: 'CONTINUE', data: { file: selection.description.toString() } } : { type: 'CANCEL' };
  }
}
