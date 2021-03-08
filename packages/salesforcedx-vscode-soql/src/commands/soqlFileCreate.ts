/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import {
  BUILDER_VIEW_TYPE,
  OPEN_WITH_COMMAND,
  telemetryService
} from '../index';

export async function soqlOpenNew(): Promise<void> {
  telemetryService.sendCommandEvent('soql_builder_open_new', process.hrtime());

  if (vscode.workspace) {
    // create untitled file
    const doc = await vscode.workspace.openTextDocument({
      language: 'soql',
      content: ''
    });

    // open with SOQL builder
    vscode.commands.executeCommand(
      OPEN_WITH_COMMAND,
      doc.uri,
      BUILDER_VIEW_TYPE
    );
  }
}
