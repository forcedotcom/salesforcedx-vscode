import { OutputEvent, SfFunctionCommand } from '@salesforce/functions-core/';
import { channelService } from '../../channels';
import { notificationService } from '../../notifications';

export function streamFunctionCommandOutput(
  name: string,
  command: SfFunctionCommand
) {
  let task: string = '';
  ['error', 'warn', 'debug', 'log'].forEach((eventType: string) => {
    command.on(eventType as OutputEvent, (data: any) => {
      channelService.appendLine(data);
    });
  });

  command.on('warn', (data: any) => {
    notificationService.showWarningMessage(data);
    channelService.appendLine(`Warning: ${data}`);
  });

  command.on('error', (data: any) => {
    channelService.appendLine(`Error: ${data}`);
  });

  command.on('json', (data: any) => {
    channelService.appendLine(JSON.stringify(data, undefined, 4));
  });

  command.on('start_action', (data: any) => {
    channelService.appendLine(data);
    task = data;
  });
  command.on('stop_action', (data: any) => {
    channelService.appendLine(`${task} ${data}`);
    task = '';
  });
  channelService.showChannelOutput();
}
