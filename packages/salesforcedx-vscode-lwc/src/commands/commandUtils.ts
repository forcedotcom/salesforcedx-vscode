/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { notificationService } from '@salesforce/salesforcedx-utils-vscode';
import { env, Uri } from 'vscode';
import { channelService } from '../channel';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';

export const showError = (e: Error, logName: string, commandName: string) => {
  telemetryService.sendException(`${logName}_error`, e.message);
  notificationService.showErrorMessage(e.message);
  notificationService.showErrorMessage(nls.localize('command_failure', commandName));
  channelService.appendLine(`Error: ${e.message}`);
  channelService.showChannelOutput();
};

export const openBrowser = (url: string) => {
  return env.openExternal(Uri.parse(url));
};
