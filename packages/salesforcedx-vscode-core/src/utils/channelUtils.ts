import { ChannelService, notificationService, SettingsService } from '@salesforce/salesforcedx-utils-vscode';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';

export const handleStartCommand = (channelService: ChannelService, command: string): void => {
  if (SettingsService.getEnableClearOutputBeforeEachCommand()) {
    channelService.clear();
  }
  channelService.showCommandWithTimestamp(`${nls.localize('channel_starting_message')}${nls.localize(command)}\n`);
};

export const handleFinishCommand = async (
  channelService: ChannelService,
  command: string,
  isSuccess: boolean,
  error: string = 'Command failed'
): Promise<void> => {
  const exitCode = isSuccess ? '0' : '1';
  channelService.showCommandWithTimestamp(nls.localize(command));
  channelService.appendLine(' ' + nls.localize('channel_end_with_exit_code', exitCode));
  // TODO: MOVE TELEMETRY HERE

  if (isSuccess) {
    await notificationService.showInformationMessage(`${nls.localize(command)} successfully ran`);
    telemetryService.sendCommandEvent(command);
  } else {
    telemetryService.sendException(command, error);
  }
};
