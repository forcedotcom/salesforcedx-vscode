/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { nls } from '../messages';
import { DevServerService } from '../service/devServerService';
import { telemetryService } from '../telemetry';
import { openBrowser, showError } from './commandUtils';

const logName = 'lightning_lwc_open';
const commandName = nls.localize('lightning_lwc_open_text');

export const lightningLwcOpen = async () => {
  const startTime = process.hrtime();

  if (DevServerService.instance.isServerHandlerRegistered()) {
    try {
      await openBrowser(DevServerService.instance.getBaseUrl());
      telemetryService.sendCommandEvent(logName, startTime);
    } catch (e) {
      showError(e, logName, commandName);
    }
  } else {
    console.log(`${logName}: server was not running, starting...`);
    await vscode.commands.executeCommand('sf.lightning.lwc.start');
    telemetryService.sendCommandEvent(logName, startTime);
  }
};
