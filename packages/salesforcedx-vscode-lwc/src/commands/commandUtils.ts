import * as vscode from 'vscode';
import { nls } from '../messages';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const {
  channelService,
  notificationService,
  telemetryService
} = sfdxCoreExports;

export function showError(e: Error, logName: string, commandName: string) {
  telemetryService.sendException(`${logName}_error`, e.message);
  notificationService.showErrorMessage(
    nls.localize('command_failure', commandName)
  );
  channelService.appendLine(`Error: ${e.message}`);
  channelService.showChannelOutput();
}
