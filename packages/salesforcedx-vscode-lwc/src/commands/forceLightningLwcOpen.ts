import * as vscode from 'vscode';
import { nls } from '../messages';
import { DevServerService } from '../service/devServerService';
import * as open from 'open';
import { lwcDevServerBaseUrl } from './constants';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const {
  channelService,
  notificationService,
  telemetryService
} = sfdxCoreExports;

const logName = 'force_lightning_lwc_open';

export async function forceLightningLwcOpen() {
  const startTime = process.hrtime();

  if (DevServerService.instance.isServerHandlerRegistered()) {
    try {
      await open(lwcDevServerBaseUrl);
      telemetryService.sendCommandEvent(logName, startTime);
    } catch (e) {
      notificationService.showErrorMessage(
        nls.localize('force_lightning_lwc_open_failed')
      );
      channelService.appendLine(
        `Error opening local development server: ${e.message}`
      );
      channelService.showChannelOutput();
      telemetryService.sendException(`${logName}_error`, e.message);
    }
  } else {
    console.log(`${logName}: server was not running, starting...`);
    await vscode.commands.executeCommand('sfdx.force.lightning.lwc.start');
    telemetryService.sendCommandEvent(logName, startTime);
  }
}
