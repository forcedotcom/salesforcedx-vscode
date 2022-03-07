/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ManifestResolver } from '@salesforce/source-deploy-retrieve';
import * as fs from 'fs';
import { join } from 'path';
import { format } from 'sinon';
import * as vscode from 'vscode';
import { nls } from '../messages';

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
  const stats = fs.statSync(sourceFsPath);
  const isFile = stats.isFile();
  if (responseText) {
    renameComponent(sourceFsPath, isFile, responseText);
    // TODO: warning prompt
  }
}

function renameComponent(componentPath: string, isFile: boolean, newName: string) {
  if (isFile) {
    componentPath = componentPath.substring(0, componentPath.lastIndexOf('/') + 1);
  }
  const lwcOrAuraPath = componentPath.substring(0, componentPath.lastIndexOf('/') + 1);
  const newComponentPath = join(lwcOrAuraPath, newName);
  const componentName = componentPath.substring(componentPath.lastIndexOf('/') + 1);
  if (!fs.existsSync(newComponentPath)) {
    const items: string[] | undefined = readItemsFromDir(componentPath);
    if (items) {
      for (const item of items) {
        // item can be file or folder(eg: _test_)
        const baseAndExtension = item.split('.');
        const baseName = baseAndExtension[0];
        const extensionSuffix = baseAndExtension.length > 1 ? '.' + baseAndExtension[1] : undefined;
        if (baseName === componentName) {
          fs.rename(
            componentPath + `/${item}`,
            componentPath + `/${newName}` + extensionSuffix,
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

function readItemsFromDir(uri: string): string[] | undefined {
  try {
    const files: string[] = fs.readdirSync(uri);
    return files;
  } catch (err) {
    console.error('Unable to scan directory: ', uri);
  }
}
