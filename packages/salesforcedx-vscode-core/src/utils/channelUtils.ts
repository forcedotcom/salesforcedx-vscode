/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChannelService, notificationService, SettingsService } from '@salesforce/salesforcedx-utils-vscode';
import { OUTPUT_CHANNEL } from '../channels';
import { coerceMessageKey, nls } from '../messages';
import { telemetryService } from '../telemetry';

const channelService = new ChannelService(OUTPUT_CHANNEL);

export const handleStartCommand = (command: string): void => {
  if (SettingsService.getEnableClearOutputBeforeEachCommand()) {
    channelService.clear();
  }
  channelService.showCommandWithTimestamp(
    `${nls.localize('channel_starting_message')}${nls.localize(coerceMessageKey(command))}\n`
  );
};

export const handleFinishCommand = async (
  command: string,
  isSuccess: boolean,
  error: string = 'Command failed'
): Promise<void> => {
  const exitCode = isSuccess ? '0' : '1';
  channelService.showCommandWithTimestamp(nls.localize(coerceMessageKey(command)));
  channelService.appendLine(' ' + nls.localize('channel_end_with_exit_code', exitCode));

  if (isSuccess) {
    await notificationService.showInformationMessage(`${nls.localize(coerceMessageKey(command))} successfully ran`);
    telemetryService.sendCommandEvent(command);
  } else {
    telemetryService.sendException(command, error);
  }
};
