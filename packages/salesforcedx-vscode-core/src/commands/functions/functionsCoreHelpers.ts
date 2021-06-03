import { SfFunctionCommand, OutputEvent } from '@salesforce/functions-core/';
import { channelService } from '../../channels';
import { notificationService } from '../../notifications';
import { window, ProgressLocation } from 'vscode';
import  { nls } from '../../messages';

export function streamFunctionCommandOutput(name: string, command: SfFunctionCommand) {
  ['error', 'warn', 'debug', 'log', 'start_action', 'stop_action'].forEach(
    (eventType: string) => {
      command.on(eventType as OutputEvent, (data: any) => {
        channelService.appendLine(data);
      });
    }
  );

  command.on('warn', (data: any) => {
    notificationService.showWarningMessage(data);
  });

  command.on('error', (data: any) => {
    notificationService.showErrorMessage(data);
  });

  command.on('json', (data: any) => {
    channelService.appendLine(JSON.stringify(data, undefined, 4));
  });

  channelService.showChannelOutput();
}

export async function showFunctionCommandProgress(name: string, execution: Promise<boolean>) {
  window.withProgress(
    {
      title: nls.localize(
        'progress_notification_text',
       name
      ),
      location: ProgressLocation.Notification,

      cancellable: false
    },
    progress => {
      return execution
    }
  );
  const status = await execution;
  if (!!status) {
    notificationService.showSuccessfulExecution(name);
  } else {
    notificationService.showFailedExecution(name);
  }
}
