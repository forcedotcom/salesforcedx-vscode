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
import { nls } from '../../messages';
import { notificationService } from '../../notifications';
import { GlobStrategy } from './globStrategies';

export class FilePathExistsChecker
  implements PostconditionChecker<DirFileNameSelection> {
  private globStrategy: GlobStrategy;
  private warningMessage: string;

  public constructor(globStrategy: GlobStrategy, warningMessage: string) {
    this.globStrategy = globStrategy;
    this.warningMessage = warningMessage;
  }

  public async check(
    inputs: ContinueResponse<DirFileNameSelection> | CancelResponse
  ): Promise<ContinueResponse<DirFileNameSelection> | CancelResponse> {
    if (inputs.type === 'CONTINUE') {
      const globs = await this.globStrategy.globs(inputs.data);
      if (!(await this.filesExist(globs)) || (await this.promptOverwrite())) {
        return inputs;
      }
    }
    return { type: 'CANCEL' };
  }

  private async filesExist(globs: GlobPattern[]): Promise<boolean> {
    const files = [];
    for (const g of globs) {
      const result = await workspace.findFiles(g);
      files.push(...result);
    }
    return files.length > 0;
  }

  private async promptOverwrite(): Promise<boolean> {
    const overwrite = await notificationService.showWarningMessage(
      this.warningMessage,
      nls.localize('warning_prompt_continue_confirm'),
      nls.localize('warning_prompt_overwrite_cancel')
    );
    return overwrite === nls.localize('warning_prompt_continue_confirm');
  }
}
