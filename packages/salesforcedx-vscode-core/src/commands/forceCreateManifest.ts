/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as fs from 'fs';
import { join } from 'path';
import { format } from 'util';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { getRootWorkspacePath } from '../util';

const DEFAULT_MANIFEST = 'package.xml';

export async function forceCreateManifest(
  sourceUri: vscode.Uri,
  uris: vscode.Uri[] | undefined
) {
  if (!uris || uris.length < 1) {
    uris = [];
    uris.push(sourceUri);
  }
  const sourcePaths = uris.map(uri => uri.fsPath);
  if (sourcePaths) {
    const componentSet = ComponentSet.fromSource(sourcePaths);
    const inputOptions = {
        placeHolder: nls.localize('manifest_input_save_placeholder'),
        prompt: nls.localize('manifest_input_save_prompt'),
        validateInput: text => {
          return text.toLowerCase().includes('.xml') ? nls.localize('manifest_input_save_prompt') : null;
        }
    } as vscode.InputBoxOptions;
    const responseText = await vscode.window.showInputBox(inputOptions);
    if (responseText === undefined) {
      // Canceled and declined to name the document
      openUntitledDocument(componentSet);
    } else {
      saveDocument(responseText, componentSet);
    }
  }
}

function openUntitledDocument(componentSet: ComponentSet) {
  vscode.workspace.openTextDocument({
    content: componentSet.getPackageXml(),
    language: 'xml'
  }).then(newManifest => {
    vscode.window.showTextDocument(newManifest);
  });
}

function saveDocument(response: string, componentSet: ComponentSet) {
  const fileName = response ? response.concat('.xml') : DEFAULT_MANIFEST;

  const manifestPath = join(getRootWorkspacePath(), 'manifest');
  if (!fs.existsSync(manifestPath)) {
    fs.mkdirSync(manifestPath);
  }
  const saveLocation = join(manifestPath, fileName);
  checkForDuplicateManifest(saveLocation, fileName);

  fs.writeFileSync(saveLocation, componentSet.getPackageXml());
  vscode.workspace.openTextDocument(saveLocation).then(newManifest => {
    vscode.window.showTextDocument(newManifest);
  });
}

function checkForDuplicateManifest(saveLocation: string, fileName: string) {
  if (fs.existsSync(saveLocation)) {
    vscode.window.showErrorMessage(format(nls.localize('manifest_input_dupe_error'), fileName));
    throw new Error(format(nls.localize('manifest_input_dupe_error'), fileName));
  }
}
