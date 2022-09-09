/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../messages';
import {
  APEX_FILE_NAME_EXTENSION,
  SOQL_FILE_NAME_EXTENSION
} from '../constants';

const auraPath = '/force-app/main/default/aura/';
const apexClassesPath = '/force-app/main/default/classes/';
const lwcPath = '/force-app/main/default/lwc/';
const functionsPath = '/functions/';

export async function forceOpenDocumentation() {
  let docUrl = '';
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const filePath = editor.document.fileName;
    const extension = path.extname(filePath);

    if (filePath.includes(auraPath)) {
      docUrl = nls.localize('aura_doc_url');
    } else if (
      filePath.includes(apexClassesPath) ||
      extension === APEX_FILE_NAME_EXTENSION
    ) {
      docUrl = nls.localize('apex_doc_url');
    } else if (extension === SOQL_FILE_NAME_EXTENSION) {
      docUrl = nls.localize('soql_doc_url');
    } else if (filePath.includes(lwcPath)) {
      docUrl = nls.localize('lwc_doc_url');
    } else if (filePath.includes(functionsPath)) {
      docUrl = nls.localize('functions_doc_url');
    }
  }

  if (docUrl === '') {
    docUrl = nls.localize('default_doc_url');
  }

  await vscode.env.openExternal(vscode.Uri.parse(docUrl));
}
