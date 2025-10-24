/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { channelService } from '../channels';

type VsCodeWindowType = 'error' | 'informational' | 'warning';
export const writeToDebuggerMessageWindow = (
  output: string,
  showVSCodeWindow?: boolean,
  vsCodeWindowType?: VsCodeWindowType
) => {
  channelService.appendLine(output);
  channelService.showChannelOutput();
  if (showVSCodeWindow && vsCodeWindowType) {
    switch (vsCodeWindowType) {
      case 'error': {
        vscode.window.showErrorMessage(output);
        break;
      }
      case 'informational': {
        vscode.window.showInformationMessage(output);
        break;
      }
      case 'warning': {
        vscode.window.showWarningMessage(output);
        break;
      }
    }
  }
};
