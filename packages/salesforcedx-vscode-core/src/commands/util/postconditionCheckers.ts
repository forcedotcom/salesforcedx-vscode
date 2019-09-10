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
import { format } from 'util';
import { workspace } from 'vscode';
import { nls } from '../../messages';
import { notificationService } from '../../notifications';
import { DirFileNameWithType } from '../forceSourceRetrieveMetadata';
import { GlobStrategy } from './globStrategies';

type SingleOrArray = DirFileNameWithType | DirFileNameWithType[];
type ContinueOrCancel = ContinueResponse<SingleOrArray> | CancelResponse;

/* tslint:disable-next-line:prefer-for-of */
export class FilePathExistsChecker
  implements PostconditionChecker<SingleOrArray> {
  private globStrategy: GlobStrategy;
  private warningMessage: string;

  public constructor(globStrategy: GlobStrategy, warningMessage: string) {
    this.globStrategy = globStrategy;
    this.warningMessage = warningMessage;
  }

  public async check(inputs: ContinueOrCancel): Promise<ContinueOrCancel> {
    if (inputs.type === 'CONTINUE') {
      const { data } = inputs;
      // normalize data into a list when processing
      const gatheredFiles = data instanceof Array ? data : [data];
      const existingFiles = await this.getExistingFiles(gatheredFiles);
      if (existingFiles.length > 0) {
        const toSkip = await this.promptOverwrite(existingFiles);
        // cancel command if cancel clicked or if skipping every file to be retrieved
        if (!toSkip || toSkip.size === gatheredFiles.length) {
          return { type: 'CANCEL' };
        }
        if (data instanceof Array) {
          inputs.data = gatheredFiles.filter(
            selection => !toSkip.has(selection)
          );
        }
      }
      return inputs;
    }
    return { type: 'CANCEL' };
  }

  private async getExistingFiles(
    gatheredFiles: DirFileNameWithType[]
  ): Promise<DirFileNameWithType[]> {
    const exists: DirFileNameWithType[] = [];
    for (const dirFile of gatheredFiles) {
      if (await this.fileExists(dirFile)) {
        exists.push(dirFile);
      }
    }
    return exists;
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

  /**
   * Warn the user of potential files to overwrite
   * @param existingFiles to potentially overwrite
   * @returns files that should not be overwritten or undefined if operation cancelled
   */
  private async promptOverwrite(
    existingFiles: DirFileNameWithType[]
  ): Promise<Set<DirFileNameWithType> | undefined> {
    const skipped = new Set<DirFileNameWithType>();
    for (let i = 0; i < existingFiles.length; i++) {
      const options = this.buildDialogOptions(existingFiles, skipped, i);
      const choice = await notificationService.showWarningModal(
        this.buildDialogMessage(existingFiles, i),
        ...options
      );
      switch (choice) {
        case 'Overwrite':
          break;
        case 'Skip':
          skipped.add(existingFiles[i]);
          break;
        case `Overwrite All (${existingFiles.length - i})`:
          return skipped;
        case `Skip All (${existingFiles.length - i})`:
          return new Set(existingFiles.slice(i));
        default:
          // Cancel
          return;
      }
    }
    return skipped;
  }

  private buildDialogMessage(
    existingFiles: DirFileNameWithType[],
    currentIndex: number
  ) {
    const existingLength = existingFiles.length;
    const current = existingFiles[currentIndex];
    let body = '';
    for (let j = currentIndex + 1; j < existingLength; j++) {
      if (j === currentIndex + 10) {
        body += `...${existingLength -
          currentIndex -
          10 +
          1} other files not shown\n`;
        break;
      }
      const { fileName, type } = existingFiles[j];
      body += `${type}:${fileName}\n`;
    }
    const otherFilesCount = existingLength - currentIndex - 1;
    return format(
      this.warningMessage,
      current.type,
      current.fileName,
      otherFilesCount > 0
        ? `${otherFilesCount} other existing components:`
        : '',
      body
    );
  }

  private buildDialogOptions(
    existingFiles: DirFileNameWithType[],
    skipped: Set<DirFileNameWithType>,
    currentIndex: number
  ) {
    const choices = ['Overwrite'];
    const numOfExistingFiles = existingFiles.length;
    if (skipped.size > 0 || skipped.size !== numOfExistingFiles - 1) {
      choices.push('Skip');
    }
    if (currentIndex < numOfExistingFiles - 1) {
      choices.push(
        `Overwrite All (${numOfExistingFiles - currentIndex})`,
        `Skip All (${numOfExistingFiles - currentIndex})`
      );
    }
    return choices;
  }
}
