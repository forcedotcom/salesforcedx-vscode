/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LibraryCommandletExecutor } from '@salesforce/salesforcedx-utils-vscode/out/src';
import { notificationService } from '@salesforce/salesforcedx-utils-vscode/out/src/commands';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/src/types';
import * as fs from 'fs';
import * as path from 'path';
import { format } from 'util';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../channels';
import { nls } from '../messages';
import { FilePathGatherer, SfdxCommandlet, SfdxWorkspaceChecker } from './util';

const RENAME_LIGHTNING_COMPONENT_EXECUTOR = 'force_rename_lightning_component';
const RENAME_INPUT_PLACEHOLDER = 'rename_component_input_placeholder';
const RENAME_INPUT_PROMPT = 'rename_component_input_prompt';
const RENAME_INPUT_DUP_ERROR = 'rename_component_input_dup_error';
const RENAME_COMPONENT_WARNING = 'rename_component_warning';

export class RenameLwcComponentExecutor extends LibraryCommandletExecutor<string> {
  private sourceFsPath: string;
  private responseText: string | undefined;
  constructor(sourceFsPath: string, responseText: string | undefined) {
    super(
      nls.localize(RENAME_LIGHTNING_COMPONENT_EXECUTOR),
      RENAME_LIGHTNING_COMPONENT_EXECUTOR,
      OUTPUT_CHANNEL
    );
    this.sourceFsPath = sourceFsPath;
    this.responseText = responseText;
  }

  public async run(
    response: ContinueResponse<string>,
    progress?: vscode.Progress<{ message?: string | undefined; increment?: number | undefined; }>,
    token?: vscode.CancellationToken
    ): Promise<boolean> {
      if (this.sourceFsPath) {
        if (this.responseText) {
          renameComponent(this.sourceFsPath, this.responseText);
          return true;
        }
      }
      return false;
  }
}

export async function forceRenameLightningComponent(sourceUri: vscode.Uri) {
  const sourceFsPath = sourceUri.fsPath;
  const inputOptions = {
    placeHolder: nls.localize(RENAME_INPUT_PLACEHOLDER),
    promopt: nls.localize(RENAME_INPUT_PROMPT)
  } as vscode.InputBoxOptions;

  const responseText = await vscode.window.showInputBox(inputOptions);
  if (sourceFsPath) {
    const commandlet = new SfdxCommandlet(
      new SfdxWorkspaceChecker(),
      new FilePathGatherer(sourceUri),
      new RenameLwcComponentExecutor(sourceFsPath, responseText)
    );
    await commandlet.run();
  }
}

function renameComponent(sourceFsPath: string, newName: string) {
  const componentPath = getComponentPath(sourceFsPath);
  const componentName = path.basename(componentPath);
  checkForDuplicateName(componentPath, newName);
  const items = fs.readdirSync(componentPath);
  if (items) {
    for (const item of items) {
      // only rename the file that has same name with component
      if (isNameMatch(item, componentName, componentPath)) {
        const newItem = item.replace(componentName, newName);
        fs.renameSync(
          path.join(componentPath, item),
          path.join(componentPath, newItem));
      }
    }
  }
  const newComponentPath = path.join(path.dirname(componentPath), newName);
  fs.renameSync(
    componentPath,
    newComponentPath);
  notificationService.showWarningMessage(nls.localize(RENAME_COMPONENT_WARNING));
}

function getComponentPath(sourceFsPath: string): string {
  const stats = fs.statSync(sourceFsPath);
  return stats.isFile() ? path.dirname(sourceFsPath) : sourceFsPath;
}

function checkForDuplicateName(componentPath: string, newName: string) {
  if (isDuplicate(componentPath, newName)) {
    const errorMessage = nls.localize(RENAME_INPUT_DUP_ERROR);
    notificationService.showErrorMessage(errorMessage);
    throw new Error(format(errorMessage));
  }
}

function isDuplicate(componentPath: string, newName: string): boolean {
  const componentPathDirName = path.dirname(componentPath);
  let lwcPath: string;
  let auraPath: string;
  if (isLwcComponent(componentPath)) {
    lwcPath = componentPathDirName;
    auraPath = path.join(path.dirname(componentPathDirName), 'aura');
  } else {
    lwcPath = path.join(path.dirname(componentPathDirName), 'lwc');
    auraPath = componentPathDirName;
  }
  if (fs.existsSync(path.join(lwcPath, newName)) || fs.existsSync(path.join(auraPath, newName))) {
    return true;
  }
  return false;
}

function isNameMatch(item: string, componentName: string, componentPath: string) {
  const isLwc = isLwcComponent(componentPath);
  let regularExp: RegExp;
  if (isLwc) {
    regularExp = new RegExp(`${componentName}\.(html|js|js-meta.xml|css|svg)`);
  } else {
    regularExp = new RegExp(`${componentName}(((Controller|Renderer|Helper)?\.js)|(\.(cmp|app|css|design|auradoc|svg)))`);
  }
  return item.match(regularExp) ? true : false;
}

function isLwcComponent(componentPath: string): boolean {
  return path.basename(path.dirname(componentPath)) === 'lwc' ? true : false;
}
