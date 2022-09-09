/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { notificationService } from '@salesforce/salesforcedx-utils-vscode/out/src/commands';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { DebugLog } from './forceAnonApexExecute';

export async function forceShowDebugStatementsInOutput() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    notificationService.showErrorMessage(
      nls.localize('unable_to_locate_editor')
    );
    return;
  }

  const debugLog = new DebugLog(editor.document.getText());
  channelService.appendLine(debugLog.debugStatements());
  channelService.showChannelOutput();
}
