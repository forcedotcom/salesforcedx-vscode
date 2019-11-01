import {
  Command,
  SfdxCommandBuilder,
  CliCommandExecutor,
  CommandOutput
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { DevServerService } from '../service/devServerService';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const {
  channelService,
  CompositeParametersGatherer,
  EmptyParametersGatherer,
  getDefaultUsernameOrAlias,
  isCLIInstalled,
  notificationService,
  ProgressNotification,
  SfdxCommandlet,
  SfdxWorkspaceChecker,
  taskViewService,
  telemetryService,
  CompositePreconditionChecker
} = sfdxCoreExports;
const SfdxCommandletExecutor = sfdxCoreExports.SfdxCommandletExecutor;

export async function forceLightningLwcStop() {
  // TODO noticationService

  // TODO telemetry
  try {
    if (DevServerService.instance.isServerHandlerRegistered()) {
      channelService.appendLine(
        nls.localize('force_lightning_lwc_server_stopping')
      );
      await DevServerService.instance.stopServer();
    }
  } catch (e) {
    console.error(`error stopping lwc dev servers: ${e}`);
    // TODO notify?
  }
}
