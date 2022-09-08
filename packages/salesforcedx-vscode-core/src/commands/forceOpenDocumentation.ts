/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as vscode from 'vscode';

export const auraDocUrl =
  'https://developer.salesforce.com/tools/vscode/en/aura/writing';
export const apexDocUrl =
  'https://developer.salesforce.com/tools/vscode/en/apex/writing';
export const soqlDocUrl =
  'https://developer.salesforce.com/tools/vscode/en/soql/soql-builder';
export const lwcDocUrl =
  'https://developer.salesforce.com/tools/vscode/en/lwc/writing';
export const functionsDocUrl =
  'https://developer.salesforce.com/tools/vscode/en/functions/overview';
export const defaultDocUrl = 'https://developer.salesforce.com/tools/vscode';

const auraPath = '/force-app/main/default/aura/';
const apexClassesPath = '/force-app/main/default/classes/';
const lwcPath = '/force-app/main/default/lwc/';
const functionsPath = '/functions/';

const apexExtension = '.apex';
const soqlExtension = '.soql';

export async function forceOpenDocumentation() {
  let docUrl = '';
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const filePath = editor.document.fileName;
    const extension = path.extname(filePath);

    if (filePath.includes(auraPath)) {
      docUrl = auraDocUrl;
    } else if (
      filePath.includes(apexClassesPath) ||
      extension === apexExtension
    ) {
      docUrl = apexDocUrl;
    } else if (extension === soqlExtension) {
      docUrl = soqlDocUrl;
    } else if (filePath.includes(lwcPath)) {
      docUrl = lwcDocUrl;
    } else if (filePath.includes(functionsPath)) {
      docUrl = functionsDocUrl;
    }
  }

  if (docUrl === '') {
    docUrl = defaultDocUrl;
  }

  await vscode.env.openExternal(vscode.Uri.parse(docUrl));
}
