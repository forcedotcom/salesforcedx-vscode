import * as vscode from 'vscode';
import { nls } from '../messages';
import { DevServerService } from '../service/devServerService';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const {
  channelService,
  notificationService,
  telemetryService
} = sfdxCoreExports;

const logName = 'force_lightning_lwc_stop';

export async function forceLightningLwcStop() {
  const startTime = process.hrtime();

  try {
    if (DevServerService.instance.isServerHandlerRegistered()) {
      channelService.appendLine(
        nls.localize('force_lightning_lwc_stop_in_progress')
      );
      await DevServerService.instance.stopServer();
      notificationService.showSuccessfulExecution(
        nls.localize('force_lightning_lwc_stop_text')
      );
      telemetryService.sendCommandEvent(logName, startTime);
    } else {
      notificationService.showWarningMessage(
        nls.localize(
          'force_lightning_lwc_stop_not_running',
          nls.localize('force_lightning_lwc_stop_text')
        )
      );
    }
  } catch (e) {
    console.error(`error stopping lwc dev servers: ${e.message}`);
    notificationService.showErrorMessage(
      nls.localize('force_lightning_lwc_stop_failed')
    );
    channelService.appendLine(
      `Error stopping local development server: ${e.message}`
    );
    channelService.showChannelOutput();
    telemetryService.sendException(`${logName}_error`, e.message);
  }
}
