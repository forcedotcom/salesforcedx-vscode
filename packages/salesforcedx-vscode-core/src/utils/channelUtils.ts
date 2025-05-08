/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChannelService, notificationService, SettingsService } from '@salesforce/salesforcedx-utils-vscode';
import { nls } from '../messages';

export const handleStartCommand = (channelService: ChannelService, command: string): void => {
  if (SettingsService.getEnableClearOutputBeforeEachCommand()) {
    channelService.clear();
  }
  channelService.showCommandWithTimestamp(`${nls.localize('channel_starting_message')}${command}\n`);
};

export const handleFinishCommand = async (
  channelService: ChannelService,
  command: string,
  isSuccess: boolean
): Promise<void> => {
  const exitCode = isSuccess ? '0' : '1';
  channelService.showCommandWithTimestamp(command);
  channelService.appendLine(' ' + nls.localize('channel_end_with_exit_code', exitCode));

  if (isSuccess) {
    await notificationService.showInformationMessage(`${command} successfully ran`);
  }
};
