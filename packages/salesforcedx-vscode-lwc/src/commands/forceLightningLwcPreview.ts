/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { componentUtil } from '@salesforce/lightning-lsp-common';
import {
  CliCommandExecutor,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { getGlobalStore, getWorkspaceSettings } from '../index';
import { nls } from '../messages';
import { DevServerService } from '../service/devServerService';
import { DEV_SERVER_PREVIEW_ROUTE } from './commandConstants';
import { openBrowser, showError } from './commandUtils';
import { ForceLightningLwcStartExecutor } from './forceLightningLwcStart';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const {
  channelService,
  notificationService,
  telemetryService,
  SfdxCommandlet,
  EmptyParametersGatherer,
  SfdxWorkspaceChecker
} = sfdxCoreExports;

export enum PreviewPlatformType {
  Desktop = 1,
  Android,
  iOS
}

export interface PreviewQuickPickItem extends vscode.QuickPickItem {
  label: string;
  detail: string;
  alwaysShow: boolean;
  picked: boolean;
  id: PreviewPlatformType;
  defaultTargetName: string;
  platformName: string;
}

export const platformInput: PreviewQuickPickItem[] = [
  {
    label: nls.localize('force_lightning_lwc_preview_desktop_label'),
    detail: nls.localize('force_lightning_lwc_preview_desktop_description'),
    alwaysShow: true,
    picked: true,
    id: PreviewPlatformType.Desktop,
    platformName: '',
    defaultTargetName: ''
  },
  {
    label: nls.localize('force_lightning_lwc_android_label'),
    detail: nls.localize('force_lightning_lwc_android_description'),
    alwaysShow: true,
    picked: false,
    id: PreviewPlatformType.Android,
    platformName: 'Android',
    defaultTargetName: 'SFDXEmulator'
  },
  {
    label: nls.localize('force_lightning_lwc_ios_label'),
    detail: nls.localize('force_lightning_lwc_ios_description'),
    alwaysShow: true,
    picked: false,
    id: PreviewPlatformType.iOS,
    platformName: 'iOS',
    defaultTargetName: 'SFDXSimulator'
  }
];

const logName = 'force_lightning_lwc_preview';
const commandName = nls.localize('force_lightning_lwc_preview_text');
export const sfdxMobilePreviewCommand = 'force:lightning:lwc:preview';
export const rememberDeviceKey = 'rememberDevice';
export const logLevelKey = 'logLevel';
export const defaultLogLevel = 'warn';

export async function forceLightningLwcPreview(sourceUri: vscode.Uri) {
  const startTime = process.hrtime();

  if (!sourceUri) {
    if (vscode.window.activeTextEditor) {
      sourceUri = vscode.window.activeTextEditor.document.uri;
    } else {
      const message = nls.localize(
        'force_lightning_lwc_preview_file_undefined',
        sourceUri
      );
      showError(new Error(message), logName, commandName);
      return;
    }
  }

  const resourcePath = sourceUri.fsPath;
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
  const platformSelection = await vscode.window.showQuickPick(platformInput, {
    placeHolder: nls.localize('force_lightning_lwc_platform_selection')
  });
  if (!platformSelection) {
    vscode.window.showWarningMessage(
      nls.localize('force_lightning_lwc_cancelled')
    );
    return;
  }

  const desktopSelected = platformSelection.id === PreviewPlatformType.Desktop;
  if (desktopSelected) {
    await startServer(true, fullUrl, startTime);
    return;
  }

  let target: string = platformSelection.defaultTargetName;
  let placeholderText =
    platformSelection.id === PreviewPlatformType.Android
      ? nls.localize('force_lightning_lwc_android_target_default')
      : nls.localize('force_lightning_lwc_ios_target_default');
  const rememberDeviceConfigured =
    getWorkspaceSettings().get(rememberDeviceKey) || false;
  const lastTarget = getRememberedDevice(platformSelection);

  // Remember device setting enabled and previous device retrieved.
  if (rememberDeviceConfigured && lastTarget) {
    const message =
      platformSelection.id === PreviewPlatformType.Android
        ? 'force_lightning_lwc_android_target_remembered'
        : 'force_lightning_lwc_ios_target_remembered';
    placeholderText = nls.localize(message, lastTarget);
    target = lastTarget;
  }
  const targetName = await vscode.window.showInputBox({
    placeHolder: placeholderText
  });

  if (targetName === undefined) {
    vscode.window.showInformationMessage(
      platformSelection.id === PreviewPlatformType.Android
        ? nls.localize('force_lightning_lwc_android_device_cancelled')
        : nls.localize('force_lightning_lwc_ios_device_cancelled')
    );
    return;
  }
  await startServer(false, fullUrl, startTime);

  // New target device entered
  if (targetName !== '') {
    updateRememberedDevice(platformSelection, targetName);
    target = targetName;
  }

  const mobileCancellationTokenSource = new vscode.CancellationTokenSource();
  const mobileCancellationToken = mobileCancellationTokenSource.token;
  const targetUsed = target || platformSelection.defaultTargetName;
  const command = new SfdxCommandBuilder()
    .withDescription(commandName)
    .withArg(sfdxMobilePreviewCommand)
    .withFlag('-p', platformSelection.platformName)
    .withFlag('-t', targetUsed)
    .withFlag('-n', componentName)
    .withFlag(
      '--loglevel',
      getWorkspaceSettings().get(logLevelKey) || defaultLogLevel
    )
    .build();

  const mobileExecutor = new CliCommandExecutor(command, {
    env: { SFDX_JSON_TO_STDOUT: 'true' }
  });
  const execution = mobileExecutor.execute(mobileCancellationToken);
  telemetryService.sendCommandEvent(logName, startTime);
  channelService.streamCommandOutput(execution);
  channelService.showChannelOutput();

  execution.processExitSubject.subscribe(async exitCode => {
    if (exitCode !== 0) {
      const message =
        platformSelection.id === PreviewPlatformType.Android
          ? nls.localize('force_lightning_lwc_android_failure', targetUsed)
          : nls.localize('force_lightning_lwc_ios_failure', targetUsed);
      showError(new Error(message), logName, commandName);

      // Error code 127 means the lwc on mobile sfdx plugin is not installed.
      if (exitCode === 127) {
        channelService.appendLine(
          nls.localize('force_lightning_lwc_no_mobile_plugin')
        );
      }
    } else if (platformSelection.id === PreviewPlatformType.iOS) {
      notificationService.showSuccessfulExecution(execution.command.toString());
      vscode.window.showInformationMessage(
        nls.localize('force_lightning_lwc_ios_start', targetUsed)
      );
    }
  });

  // TODO: Remove this when SFDX Plugin launches Android Emulator as separate process.
  // listen for Android Emulator finished
  if (platformSelection.id === PreviewPlatformType.Android) {
    execution.stdoutSubject.subscribe(async data => {
      if (data && data.toString().includes('Opening Browser')) {
        notificationService.showSuccessfulExecution(
          execution.command.toString()
        );
        vscode.window.showInformationMessage(
          nls.localize('force_lightning_lwc_android_start', targetUsed)
        );
      }
    });
  }
}

async function startServer(
  desktopSelected: boolean,
  fullUrl: string,
  startTime: [number, number]
) {
  if (!DevServerService.instance.isServerHandlerRegistered()) {
    console.log(`${logName}: server was not running, starting...`);
    const preconditionChecker = new SfdxWorkspaceChecker();
    const parameterGatherer = new EmptyParametersGatherer();
    const executor = new ForceLightningLwcStartExecutor({
      openBrowser: desktopSelected,
      fullUrl
    });

    const commandlet = new SfdxCommandlet(
      preconditionChecker,
      parameterGatherer,
      executor
    );

    await commandlet.run();
    telemetryService.sendCommandEvent(logName, startTime);
  } else if (desktopSelected) {
    try {
      await openBrowser(fullUrl);
      telemetryService.sendCommandEvent(logName, startTime);
    } catch (e) {
      showError(e, logName, commandName);
    }
  }
}

function getRememberedDevice(platform: PreviewQuickPickItem): string {
  return getGlobalStore().get(`last${platform.platformName}Device`, '');
}

function updateRememberedDevice(
  platform: PreviewQuickPickItem,
  deviceName: string
) {
  getGlobalStore().update(`last${platform.platformName}Device`, deviceName);
}
