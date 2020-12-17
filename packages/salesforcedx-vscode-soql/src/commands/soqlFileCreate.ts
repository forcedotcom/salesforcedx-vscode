/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { EDITOR_VIEW_TYPE } from '../constants';
import { telemetryService } from '../telemetry';

export async function soqlOpenNew() {
  telemetryService.sendCommandEvent('soql_builder_open_new', process.hrtime());

  if (vscode.workspace) {
    // create untitled file
    const doc = await vscode.workspace.openTextDocument({
      language: 'soql',
      content: ''
    });

    // open with SOQL builder
    vscode.commands.executeCommand(
      'vscode.openWith',
      doc.uri,
      EDITOR_VIEW_TYPE
    );
  }
}
