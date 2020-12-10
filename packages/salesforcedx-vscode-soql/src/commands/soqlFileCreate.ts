/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { EDITOR_VIEW_TYPE } from '../constants';
import { telemetryService } from '../telemetry';

export async function soqlOpenNew() {
  telemetryService.sendCommandEvent('soql_builder_open_new', process.hrtime());

  if (vscode.workspace) {
    // create untitled file
    const newFileUri = vscode.Uri.file(
      path.join(vscode.workspace.rootPath!, 'untitled.soql')
    ).with({ scheme: 'untitled' });
    await vscode.workspace.openTextDocument(newFileUri);

    // open with SOQL builder
    vscode.commands.executeCommand(
      'vscode.openWith',
      newFileUri,
      EDITOR_VIEW_TYPE
    );
  }
}
