/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { notificationService } from '@salesforce/salesforcedx-utils-vscode';
import { LibraryCommandletExecutor } from '@salesforce/salesforcedx-utils-vscode';
import { CancelResponse, ContinueResponse, ParametersGatherer } from '@salesforce/salesforcedx-utils-vscode';
import { CreateUtil } from '@salesforce/templates';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../channels';
import { nls } from '../messages';
import { ComponentName, getComponentName, getComponentPath, isLwcComponent, TEST_FOLDER } from '../util';
import { SfCommandlet, SfWorkspaceChecker } from './util';
import { LwcAuraDuplicateComponentCheckerForRename } from './util';
import {
  isNameMatch,
  RENAME_ERROR,
  RENAME_INPUT_PLACEHOLDER,
  RENAME_INPUT_PROMPT,
  RENAME_LIGHTNING_COMPONENT_EXECUTOR,
  RENAME_WARNING
} from './util/lwcAuraDuplicateDetectionUtils';

export class RenameLwcComponentExecutor extends LibraryCommandletExecutor<ComponentName> {
  private sourceFsPath: string;
  constructor(sourceFsPath: string) {
    super(nls.localize(RENAME_LIGHTNING_COMPONENT_EXECUTOR), RENAME_LIGHTNING_COMPONENT_EXECUTOR, OUTPUT_CHANNEL);
    this.sourceFsPath = sourceFsPath;
  }

  public async run(response: ContinueResponse<ComponentName>): Promise<boolean> {
    let newComponentName = response.data.name?.trim();
    if (newComponentName && this.sourceFsPath) {
      newComponentName = await inputGuard(this.sourceFsPath, newComponentName);
      try {
        await renameComponent(this.sourceFsPath, newComponentName);
        return true;
      } catch (err) {
        const errorMessage = nls.localize(RENAME_ERROR);
        void notificationService.showErrorMessage(errorMessage);
        throw err;
      }
    }
    return false;
  }
}

export const renameLightningComponent = (sourceUri: vscode.Uri): void => {
  const sourceFsPath = sourceUri.fsPath;
  if (sourceFsPath) {
    const commandlet = new SfCommandlet(
      new SfWorkspaceChecker(),
      new GetComponentName(sourceFsPath),
      new RenameLwcComponentExecutor(sourceFsPath),
      new LwcAuraDuplicateComponentCheckerForRename(sourceFsPath)
    );
    void commandlet.run();
  }
};

export class GetComponentName implements ParametersGatherer<ComponentName> {
  private sourceFsPath: string;
  constructor(sourceFsPath: string) {
    this.sourceFsPath = sourceFsPath;
  }
  public async gather(): Promise<CancelResponse | ContinueResponse<ComponentName>> {
    const inputOptions = {
      value: getComponentName(await getComponentPath(this.sourceFsPath)),
      placeHolder: nls.localize(RENAME_INPUT_PLACEHOLDER),
      promopt: nls.localize(RENAME_INPUT_PROMPT)
    } as vscode.InputBoxOptions;
    const inputResult = await vscode.window.showInputBox(inputOptions);
    return inputResult ? { type: 'CONTINUE', data: { name: inputResult } } : { type: 'CANCEL' };
  }
}

export const inputGuard = async (sourceFsPath: string, newName: string): Promise<string> => {
  const componentPath = await getComponentPath(sourceFsPath);
  if (isLwcComponent(componentPath)) {
    newName = newName.charAt(0).toLowerCase() + newName.slice(1);
  }
  CreateUtil.checkInputs(newName);
  return newName;
};

const renameComponent = async (sourceFsPath: string, newName: string): Promise<void> => {
  const componentPath = await getComponentPath(sourceFsPath);
  const componentName = getComponentName(componentPath);
  const items = await fs.promises.readdir(componentPath);
  for (const item of items) {
    // only rename the file that has same name with component
    if (isNameMatch(item, componentName, componentPath)) {
      const newItem = item.replace(componentName, newName);
      await fs.promises.rename(path.join(componentPath, item), path.join(componentPath, newItem));
    }
    if (item === TEST_FOLDER) {
      const testFolderPath = path.join(componentPath, TEST_FOLDER);
      const testFiles = await fs.promises.readdir(testFolderPath);
      for (const file of testFiles) {
        if (isNameMatch(file, componentName, componentPath)) {
          const newFile = file.replace(componentName, newName);
          await fs.promises.rename(path.join(testFolderPath, file), path.join(testFolderPath, newFile));
        }
      }
    }
  }
  const newComponentPath = path.join(path.dirname(componentPath), newName);
  await fs.promises.rename(componentPath, newComponentPath);
  void notificationService.showWarningMessage(nls.localize(RENAME_WARNING));
};
