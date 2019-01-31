/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

export default class SfdxProjectPath {
  public static getPath() {
    return vscode.workspace!.workspaceFolders![0].uri.fsPath;
  }
}
