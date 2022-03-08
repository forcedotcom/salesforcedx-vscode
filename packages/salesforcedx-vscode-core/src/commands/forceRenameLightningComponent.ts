/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import { format } from 'sinon';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { getRootWorkspacePath } from '../util';

const RENAME_INPUT_PLACEHOLDER = 'rename_comp_input_placeholder';
const REAME_INPUT_PROMPT = 'rename_comp_input_prompt';
const REANME_INPUT_DUP_ERROR = 'rename_comp_input_dup_error';

// export class RenameLwcComponentExecutor extends LibraryCommandletExecutor<string> {

//   public async run() {

//   }
// }

export async function forceRenameLightningComponent(sourceUri: vscode.Uri) {
  const inputOptions = {
    placeHolder: nls.localize(RENAME_INPUT_PLACEHOLDER),
    promopt: nls.localize(REAME_INPUT_PROMPT)
  } as vscode.InputBoxOptions;

  const responseText = await vscode.window.showInputBox(inputOptions);
  const sourceFsPath = sourceUri.fsPath;
  if (responseText) {
    renameComponent(sourceFsPath, responseText);
    // TODO: warning prompt
  }
}

function renameComponent(sourceFsPath: string, newName: string) {
  const stats = fs.statSync(sourceFsPath);
  const componentPath = stats.isFile() ? path.dirname(sourceFsPath) : sourceFsPath;
  const newComponentPath = path.join(path.dirname(componentPath), newName);
  const componentName = path.basename(componentPath);
  if (!fs.existsSync(newComponentPath)) {
    const items: string[] | undefined = readItemsFromDir(componentPath);
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
    fs.rename(
      componentPath,
      newComponentPath,
      err => {
        if (err) {
            console.log(err);
        }
    });
  } else {
    vscode.window.showErrorMessage(nls.localize(REANME_INPUT_DUP_ERROR));
    throw new Error(format(nls.localize(REANME_INPUT_DUP_ERROR)));
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

function readItemsFromDir(uri: string): string[] | undefined {
  try {
    const files: string[] = fs.readdirSync(uri);
    return files;
  } catch (err) {
    console.error('Unable to scan directory: ', uri);
  }
}
