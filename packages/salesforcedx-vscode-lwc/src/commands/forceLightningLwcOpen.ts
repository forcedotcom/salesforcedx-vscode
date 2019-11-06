import * as vscode from 'vscode';
import { nls } from '../messages';
import { DevServerService } from '../service/devServerService';
import { lwcDevServerBaseUrl } from './commandConstants';
import { openBrowser, showError } from './commandUtils';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const { telemetryService } = sfdxCoreExports;

const logName = 'force_lightning_lwc_open';
const commandName = nls.localize('force_lightning_lwc_open_text');

export async function forceLightningLwcOpen() {
  const startTime = process.hrtime();

  if (DevServerService.instance.isServerHandlerRegistered()) {
    try {
      await openBrowser(lwcDevServerBaseUrl);
      telemetryService.sendCommandEvent(logName, startTime);
    } catch (e) {
      showError(e, logName, commandName);
    }
  } else {
    console.log(`${logName}: server was not running, starting...`);
    await vscode.commands.executeCommand('sfdx.force.lightning.lwc.start');
    telemetryService.sendCommandEvent(logName, startTime);
  }
}
