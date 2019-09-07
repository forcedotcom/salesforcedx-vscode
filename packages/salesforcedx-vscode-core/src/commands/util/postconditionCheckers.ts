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
import { DirFileNameWithType } from '../forceSourceRetrieveMetadata';
import { GlobStrategy } from './globStrategies';

type InputsType = DirFileNameWithType | DirFileNameWithType[];
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
      let exists: DirFileNameWithType[] = [];
      if (inputs.data instanceof Array) {
        for (const dirFile of inputs.data) {
          if (await this.fileExists(dirFile)) {
            exists.push(dirFile);
          }
        }
      } else {
        exists = (await this.fileExists(inputs.data)) ? [inputs.data] : [];
      }

      if (exists.length > 0) {
        const toSkip = await this.promptOverwrite(exists);
        if (inputs.data instanceof Array) {
          if (!toSkip || toSkip.size === inputs.data.length) {
            return { type: 'CANCEL' };
          }
          inputs.data = inputs.data.filter(selection => !toSkip.has(selection));
        }
      }
      return inputs;
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

  private async promptOverwrite(
    exists: InputsType
  ): Promise<Set<DirFileNameWithType> | undefined> {
    if (!(exists instanceof Array)) {
      exists = [exists];
    }
    const skip = new Set<DirFileNameWithType>();
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < exists.length; i++) {
      const choices = ['Overwrite'];
      if (skip.size > 0 || skip.size !== exists.length - 1) {
        choices.push('Skip');
      }
      if (i < exists.length - 1) {
        choices.push(
          `Overwrite All (${exists.length - i})`,
          `Skip All (${exists.length - i})`
        );
      }
      const choice = await notificationService.showWarningModal(
        this.warningMessage,
        ...choices
      );
      switch (choice) {
        case 'Overwrite':
          break;
        case 'Skip':
          skip.add(exists[i]);
          break;
        case `Overwrite All (${exists.length - i})`:
          return skip;
        case `Skip All (${exists.length - i})`:
          return new Set(exists.slice(i));
        default:
          // Cancel
          return;
      }
    }
    return skip;
  }
}
