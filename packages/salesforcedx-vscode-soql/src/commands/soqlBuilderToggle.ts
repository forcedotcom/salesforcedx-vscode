/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import {
  BUILDER_VIEW_TYPE,
  EDITOR_VIEW_TYPE,
  OPEN_WITH_COMMAND,
  telemetryService
} from '../index';

export async function soqlBuilderToggle(doc: vscode.Uri): Promise<void> {
  telemetryService.sendCommandEvent('soql_builder_toggle', process.hrtime());

  const viewType = vscode.window.activeTextEditor
    ? BUILDER_VIEW_TYPE
    : EDITOR_VIEW_TYPE;

  vscode.commands.executeCommand(
    OPEN_WITH_COMMAND,
    vscode.Uri.file(doc.fsPath),
    viewType
  );
}
