/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { telemetryService } from '../../telemetry';

/**
 * If testUri is specified, returns the workspace folder containing the test if it exists.
 * Otherwise, return the first workspace folder if it exists.
 * @param testUri optional testUri
 */
export const getTestWorkspaceFolder = (testUri?: vscode.Uri) => {
  let workspaceFolder;
  if (testUri) {
    workspaceFolder = vscode.workspace.getWorkspaceFolder(testUri);
  } else {
    workspaceFolder = vscode.workspace.workspaceFolders![0];
  }
  if (workspaceFolder) {
    return workspaceFolder;
  } else {
    const errorMessage = nls.localize('no_workspace_folder_found_for_test_text');
    console.error(errorMessage);
    vscode.window.showErrorMessage(errorMessage);
    telemetryService.sendException('lwc_test_no_workspace_folder_found_for_test', errorMessage);
  }
};
