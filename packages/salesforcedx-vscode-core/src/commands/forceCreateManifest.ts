/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as vscode from 'vscode';
import { nls } from '../messages';

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
}
