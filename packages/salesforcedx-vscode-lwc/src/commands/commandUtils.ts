/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { channelService } from '@salesforce/salesforcedx-utils-vscode/out/src/channels';
import * as vscode from 'vscode';
import { nls } from '../messages';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const { notificationService, telemetryService } = sfdxCoreExports;

export function showError(e: Error, logName: string, commandName: string) {
  telemetryService.sendException(`${logName}_error`, e.message);
  notificationService.showErrorMessage(e.message);
  notificationService.showErrorMessage(
    nls.localize('command_failure', commandName)
  );
  channelService.appendLine(`Error: ${e.message}`);
  channelService.showChannelOutput();
}

export function openBrowser(url: string) {
  return vscode.env.openExternal(vscode.Uri.parse(url));
}
