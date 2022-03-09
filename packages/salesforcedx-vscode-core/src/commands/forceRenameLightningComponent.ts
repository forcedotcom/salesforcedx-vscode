/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LibraryCommandletExecutor } from '@salesforce/salesforcedx-utils-vscode/out/src';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/src/types';
import { notificationService } from '@salesforce/salesforcedx-utils-vscode/out/src/commands';
import * as fs from 'fs';
import * as path from 'path';
import { format } from 'util';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../channels';
import { nls } from '../messages';
import { FilePathGatherer, SfdxCommandlet, SfdxWorkspaceChecker } from './util';

const RENAME_LIGHTNING_COMPONENT_EXECUTOR = 'force_rename_lightning_component';
const RENAME_INPUT_PLACEHOLDER = 'rename_comp_input_placeholder';
const REAME_INPUT_PROMPT = 'rename_comp_input_prompt';
const REANME_INPUT_DUP_ERROR = 'rename_comp_input_dup_error';
const RENAME_COMP_WARNING = 'rename_comp_warning';

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
        }
        return true;
      }
      return false;
  }
}

export async function forceRenameLightningComponent(sourceUri: vscode.Uri) {
  const sourceFsPath = sourceUri.fsPath;
  const inputOptions = {
    placeHolder: nls.localize(RENAME_INPUT_PLACEHOLDER),
    promopt: nls.localize(REAME_INPUT_PROMPT)
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
  const items = readItemsFromDir(componentPath);
  if (items) {
    for (const item of items) {
      // item can be file or folder(eg: _test_)
      const baseAndExtension = getBaseNameAndExtension(item);
      const baseName = baseAndExtension[0];
      const extensionSuffix = baseAndExtension[1];
      if (baseName === componentName) {
        const newItem = newName + extensionSuffix;
        fs.rename(
          path.join(componentPath, item),
          path.join(componentPath, newItem),
          err => {
            if (err) {
                console.log(err);
            }
        });
      }
    }
  }
  const newComponentPath = path.join(path.dirname(componentPath), newName);
  fs.rename(
    componentPath,
    newComponentPath,
    err => {
      if (err) {
          console.log(err);
      }
  });
  notificationService.showWarningMessage(nls.localize(RENAME_COMP_WARNING));
}

function getComponentPath(sourceFsPath: string): string {
  const stats = fs.statSync(sourceFsPath);
  return stats.isFile() ? path.dirname(sourceFsPath) : sourceFsPath;
}

function checkForDuplicateName(componentPath: string, newName: string) {
  if (isDuplicate(componentPath, newName)) {
    notificationService.showErrorMessage(nls.localize(REANME_INPUT_DUP_ERROR));
    throw new Error(format(nls.localize(REANME_INPUT_DUP_ERROR)));
  }
}

function isDuplicate(componentPath: string, newName: string): boolean {
  const isLwc = path.basename(path.dirname(componentPath)) === 'lwc' ? true : false;
  const lwcPath = isLwc ? path.dirname(componentPath) : path.join(path.dirname(path.dirname(componentPath)), 'lwc');
  const auraPath = isLwc ? path.join(path.dirname(path.dirname(componentPath)), 'aura') : path.dirname(componentPath);
  if (fs.existsSync(path.join(lwcPath, newName)) || fs.existsSync(path.join(auraPath, newName))) {
    return true;
  }
  return false;
}

function readItemsFromDir(uri: string): string[] | undefined {
  try {
    const files: string[] = fs.readdirSync(uri);
    return files;
  } catch (err) {
    console.error('Unable to scan directory: ', uri);
  }
}

function getBaseNameAndExtension(item: string): string[] {
  const splited = item.split('.');
  const baseName = splited[0];
  let extensionSuffix = '';
  if (splited.length > 1) {
    for (let i = 1; i < splited.length; i++) {
      extensionSuffix += '.' + splited[i];
    }
  }
  return [baseName, extensionSuffix];
}
