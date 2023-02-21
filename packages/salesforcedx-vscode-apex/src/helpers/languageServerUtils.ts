/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  extensionUris,
  projectPaths
} from '@salesforce/salesforcedx-utils-vscode';
import { copyFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import * as vscode from 'vscode';
import { VSCODE_APEX_EXTENSION_NAME } from '../constants';

const setupDB = (): void => {
  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders[0]
  ) {
    const dbPath = projectPaths.apexLanguageServerDatabase();
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }

    try {
      const extensionUri = extensionUris.extensionUri(
        VSCODE_APEX_EXTENSION_NAME
      );
      const systemDb = extensionUris
        .join(extensionUri, join('resources', 'apex.db'))
        .toString();

      if (existsSync(systemDb)) {
        copyFileSync(systemDb, dbPath);
      }
    } catch (e) {
      console.log(e);
    }
  }
};

export const languageServerUtils = {
  setupDB
};
