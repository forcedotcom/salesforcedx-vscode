/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  CancelResponse,
  ContinueResponse,
  DirFileNameSelection,
  PostconditionChecker
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { GlobPattern, workspace } from 'vscode';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { notificationService } from '../../notifications';
import { GlobStrategy } from './globStrategies';

type InputsType = DirFileNameSelection | DirFileNameSelection[];
type ContinueOrCancel = ContinueResponse<InputsType> | CancelResponse;

export class FilePathExistsChecker implements PostconditionChecker<InputsType> {
  private globStrategy: GlobStrategy;
  private warningMessage: string;

  public constructor(globStrategy: GlobStrategy, warningMessage: string) {
    this.globStrategy = globStrategy;
    this.warningMessage = warningMessage;
  }

  public async check(inputs: ContinueOrCancel): Promise<ContinueOrCancel> {
    if (inputs.type === 'CONTINUE') {
      let exists: DirFileNameSelection[] = [];
      if (inputs.data instanceof Array) {
        for (const dirFile of inputs.data) {
          if (await this.fileExists(dirFile)) {
            exists.push(dirFile);
          }
        }
      } else {
        exists = (await this.fileExists(inputs.data)) ? [inputs.data] : [];
      }

      if (exists.length === 0 || (await this.promptOverwrite())) {
        return inputs;
      }
    }
    return { type: 'CANCEL' };
  }

  private async fileExists(selection: DirFileNameSelection): Promise<boolean> {
    const files = [];
    const globs = await this.globStrategy.globs(selection);
    for (const g of globs) {
      const result = await workspace.findFiles(g);
      files.push(...result);
    }
    return files.length > 0;
  }

  private async promptOverwrite(): Promise<boolean> {
    const overwrite = await notificationService.showWarningModal(
      this.warningMessage,
      nls.localize('warning_prompt_continue_confirm')
    );
    return overwrite === nls.localize('warning_prompt_continue_confirm');
  }
}
