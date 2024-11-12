/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as vscode from 'vscode';
import {
  APEX_CLASSES_PATH,
  APEX_FILE_NAME_EXTENSION,
  AURA_PATH,
  FUNCTIONS_PATH,
  LWC_PATH,
  SOQL_FILE_NAME_EXTENSION
} from '../constants';
import { nls } from '../messages';

export const openDocumentation = (): void => {
  let docUrl = '';
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const filePath = editor.document.fileName;
    const extension = path.extname(filePath);

    if (filePath.includes(AURA_PATH)) {
      docUrl = nls.localize('aura_doc_url');
    } else if (filePath.includes(APEX_CLASSES_PATH) || extension === APEX_FILE_NAME_EXTENSION) {
      docUrl = nls.localize('apex_doc_url');
    } else if (extension === SOQL_FILE_NAME_EXTENSION) {
      docUrl = nls.localize('soql_doc_url');
    } else if (filePath.includes(LWC_PATH)) {
      docUrl = nls.localize('lwc_doc_url');
    } else if (filePath.includes(FUNCTIONS_PATH)) {
      docUrl = nls.localize('functions_doc_url');
    }
  }

  if (docUrl === '') {
    docUrl = nls.localize('default_doc_url');
  }

  void vscode.env.openExternal(vscode.Uri.parse(docUrl));
};
