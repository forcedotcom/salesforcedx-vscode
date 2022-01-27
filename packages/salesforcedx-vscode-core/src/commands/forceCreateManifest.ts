/*
 * Copyright (c) 2019, salesforce.com, inc.
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
        placeHolder: nls.localize('manifest_editor_save_placeholder'),
        prompt: nls.localize('manifest_editor_save_prompt'),
        validateInput: text => {
          return text.includes('.xml') ? 'Remove file extension' : null;
        }
    } as vscode.InputBoxOptions;
    const response = await vscode.window.showInputBox(inputOptions);
    if (response === undefined) {
      // Canceled and declined to name the document
      openUntitledDocument(componentSet);
    } else {
      saveDocument(response, componentSet);
    }
  }
}

function openUntitledDocument(componentSet: ComponentSet) {
  try {
    vscode.workspace.openTextDocument({
      content: componentSet.getPackageXml(),
      language: 'xml'
    }).then(newManifest => {
      vscode.window.showTextDocument(newManifest);
    });
  } catch (exception) {
    console.log(nls.localize('error_creating_packagexml', exception));
  }
}

function saveDocument(response: string, componentSet: ComponentSet) {
  const fileName = response ? response.concat('.xml') : 'package.xml';

  const manifestPath = join(getRootWorkspacePath(), 'manifest');
  if (!fs.existsSync(manifestPath)) {
    fs.mkdirSync(manifestPath);
  }
  const saveLocation = join(manifestPath, fileName);
  checkForDuplicateManifest(saveLocation, fileName);

  try {
    fs.writeFileSync(saveLocation, componentSet.getPackageXml());
    vscode.workspace.openTextDocument(saveLocation).then(newManifest => {
      console.log('did not get here');
      vscode.window.showTextDocument(newManifest);
    });
  } catch (e) {
    const error = e.message;
    console.log(format(nls.localize('error_creating_packagexml'), error));
  }
}

function checkForDuplicateManifest(saveLocation: string, fileName: string) {
  if (fs.existsSync(saveLocation)) {
    vscode.window.showErrorMessage(format(nls.localize('manifest_editor_dupe_error'), fileName));
    throw new Error(format(nls.localize('manifest_editor_dupe_error'), fileName));
  }
}
