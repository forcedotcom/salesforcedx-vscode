import * as fs from 'fs';
import { componentUtil } from 'lightning-lsp-common';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { DevServerService } from '../service/devServerService';
import { DEV_SERVER_PREVIEW_ROUTE } from './commandConstants';
import { openBrowser, showError } from './commandUtils';
import { ForceLightningLwcStartExecutor } from './forceLightningLwcStart';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const {
  telemetryService,
  SfdxCommandlet,
  EmptyParametersGatherer,
  SfdxWorkspaceChecker
} = sfdxCoreExports;

const logName = 'force_lightning_lwc_preview';
const commandName = nls.localize('force_lightning_lwc_preview_text');

export async function forceLightningLwcPreview(sourceUri: vscode.Uri) {
  const startTime = process.hrtime();

  const resourcePath = sourceUri.path;
  if (!resourcePath || !fs.existsSync(resourcePath)) {
    const message = nls.localize(
      'force_lightning_lwc_preview_no_file',
      resourcePath
    );
    showError(new Error(message), logName, commandName);
    return;
  }

  const isSFDX = true; // TODO support non SFDX projects
  const isDirectory = fs.lstatSync(resourcePath).isDirectory();
  const componentName = isDirectory
    ? componentUtil.moduleFromDirectory(resourcePath, isSFDX)
    : componentUtil.moduleFromFile(resourcePath, isSFDX);
  if (!componentName) {
    const message = nls.localize('force_lightning_lwc_preview_unsupported');
    showError(new Error(message), logName, commandName);
    return;
  }

  const fullUrl = `${DEV_SERVER_PREVIEW_ROUTE}/${componentName}`;

  if (DevServerService.instance.isServerHandlerRegistered()) {
    try {
      await openBrowser(fullUrl);
      telemetryService.sendCommandEvent(logName, startTime);
    } catch (e) {
      showError(e, logName, commandName);
    }
  } else {
    console.log(`${logName}: server was not running, starting...`);
    const preconditionChecker = new SfdxWorkspaceChecker();
    const parameterGatherer = new EmptyParametersGatherer();
    const executor = new ForceLightningLwcStartExecutor({
      openBrowser: true,
      fullUrl
    });

    const commandlet = new SfdxCommandlet(
      preconditionChecker,
      parameterGatherer,
      executor
    );

    await commandlet.run();
    telemetryService.sendCommandEvent(logName, startTime);
  }
}
