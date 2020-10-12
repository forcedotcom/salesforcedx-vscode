/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { channelService } from '@salesforce/salesforcedx-utils-vscode/out/src/channels';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { DevServerService } from '../service/devServerService';
import { showError } from './commandUtils';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const { notificationService, telemetryService } = sfdxCoreExports;

const logName = 'force_lightning_lwc_stop';
const commandName = nls.localize('force_lightning_lwc_stop_text');

export async function forceLightningLwcStop() {
  const startTime = process.hrtime();

  try {
    if (DevServerService.instance.isServerHandlerRegistered()) {
      channelService.appendLine(
        nls.localize('force_lightning_lwc_stop_in_progress')
      );
      await DevServerService.instance.stopServer();
      notificationService.showSuccessfulExecution(
        nls.localize('force_lightning_lwc_stop_text')
      );
      telemetryService.sendCommandEvent(logName, startTime);
    } else {
      notificationService.showWarningMessage(
        nls.localize('force_lightning_lwc_stop_not_running')
      );
    }
  } catch (e) {
    showError(e, logName, commandName);
  }
}
