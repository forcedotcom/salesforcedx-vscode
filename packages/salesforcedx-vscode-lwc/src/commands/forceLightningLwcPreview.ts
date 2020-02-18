/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { componentUtil } from '@salesforce/lightning-lsp-common';
import * as fs from 'fs';
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

  if (!sourceUri) {
    const message = nls.localize(
      'force_lightning_lwc_preview_file_undefined',
      sourceUri
    );
    showError(new Error(message), logName, commandName);
    return;
  }

  const resourcePath = sourceUri.path;
  if (!resourcePath) {
    const message = nls.localize(
      'force_lightning_lwc_preview_file_undefined',
      resourcePath
    );
    showError(new Error(message), logName, commandName);
    return;
  }

  if (!fs.existsSync(resourcePath)) {
    const message = nls.localize(
      'force_lightning_lwc_preview_file_nonexist',
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
    const message = nls.localize(
      'force_lightning_lwc_preview_unsupported',
      resourcePath
    );
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
