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
import { nls } from '../messages';
import { DevServerService } from '../service/devServerService';
import { PreviewService } from '../service/previewService';
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
  SfdxWorkspaceChecker,
  sfdxCoreSettings
} = sfdxCoreExports;

enum PreviewPlatformType {
  Desktop = 1,
  Android,
  iOS
}

export const enum PlatformName {
  Desktop = 'Desktop',
  Android = 'Android',
  iOS = 'iOS'
}

interface PreviewQuickPickItem extends vscode.QuickPickItem {
  label: string;
  detail: string;
  alwaysShow: boolean;
  picked: boolean;
  id: PreviewPlatformType;
  defaultTargetName: string;
  platformName: keyof typeof PlatformName;
}

export const platformOptions: PreviewQuickPickItem[] = [
  {
    label: nls.localize('force_lightning_lwc_preview_desktop_label'),
    detail: nls.localize('force_lightning_lwc_preview_desktop_description'),
    alwaysShow: true,
    picked: true,
    id: PreviewPlatformType.Desktop,
    platformName: PlatformName.Desktop,
    defaultTargetName: ''
  },
  {
    label: nls.localize('force_lightning_lwc_android_label'),
    detail: nls.localize('force_lightning_lwc_android_description'),
    alwaysShow: true,
    picked: false,
    id: PreviewPlatformType.Android,
    platformName: PlatformName.Android,
    defaultTargetName: 'SFDXEmulator'
  },
  {
    label: nls.localize('force_lightning_lwc_ios_label'),
    detail: nls.localize('force_lightning_lwc_ios_description'),
    alwaysShow: true,
    picked: false,
    id: PreviewPlatformType.iOS,
    platformName: PlatformName.iOS,
    defaultTargetName: 'SFDXSimulator'
  }
];

const logName = 'force_lightning_lwc_preview';
const commandName = nls.localize('force_lightning_lwc_preview_text');
const sfdxMobilePreviewCommand = 'force:lightning:lwc:preview';
const androidSuccessString = 'Launching... Opening Browser';

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

  // Preform existing desktop behavior if mobile is not enabled.
  if (!PreviewService.instance.isMobileEnabled()) {
    await startServer(true, componentName, startTime);
    return;
  }

  await selectPlatformAndExecute(startTime, componentName);
}

/**
 * Starts the lwc server if it is not already running.
 *
 * @param isDesktop if desktop browser is selected
 * @param componentName name of the component to preview
 * @param startTime start time of the preview command
 */
async function startServer(
  isDesktop: boolean,
  componentName: string,
  startTime: [number, number]
) {
  if (!DevServerService.instance.isServerHandlerRegistered()) {
    console.log(`${logName}: server was not running, starting...`);
    const preconditionChecker = new SfdxWorkspaceChecker();
    const parameterGatherer = new EmptyParametersGatherer();
    const executor = new ForceLightningLwcStartExecutor({
      openBrowser: isDesktop,
      componentName
    });

    const commandlet = new SfdxCommandlet(
      preconditionChecker,
      parameterGatherer,
      executor
    );

    await commandlet.run();
    telemetryService.sendCommandEvent(logName, startTime);
  } else if (isDesktop) {
    try {
      const fullUrl = DevServerService.instance.getComponentPreviewUrl(
        componentName
      );
      await openBrowser(fullUrl);
      telemetryService.sendCommandEvent(logName, startTime);
    } catch (e) {
      showError(e, logName, commandName);
    }
  }
}

/**
 * Prompts the user to select a platform to preview the LWC on. Android and iOS
 * are handled by the @salesforce/lwc-dev-mobile sfdx package.
 *
 * @param startTime start time of the preview command
 * @param componentName name of the lwc
 */
async function selectPlatformAndExecute(
  startTime: [number, number],
  componentName: string
) {
  const platformSelection = await vscode.window.showQuickPick(platformOptions, {
    placeHolder: nls.localize('force_lightning_lwc_platform_selection')
  });
  if (!platformSelection) {
    vscode.window.showWarningMessage(
      nls.localize('force_lightning_lwc_cancelled')
    );
    return;
  }

  const isDesktop = platformSelection.id === PreviewPlatformType.Desktop;
  if (isDesktop) {
    await startServer(true, componentName, startTime);
    return;
  }

  const isAndroid = platformSelection.id === PreviewPlatformType.Android;
  let target: string = platformSelection.defaultTargetName;
  let placeholderText = isAndroid
    ? nls.localize('force_lightning_lwc_android_target_default')
    : nls.localize('force_lightning_lwc_ios_target_default');
  const lastTarget = PreviewService.instance.getRememberedDevice(
    platformSelection.platformName
  );

  // Remember device setting enabled and previous device retrieved.
  if (PreviewService.instance.isRememberedDeviceEnabled() && lastTarget) {
    const message = isAndroid
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
      isAndroid
        ? nls.localize('force_lightning_lwc_android_device_cancelled')
        : nls.localize('force_lightning_lwc_ios_device_cancelled')
    );
    return;
  }
  await startServer(false, componentName, startTime);

  // New target device entered
  if (targetName !== '') {
    PreviewService.instance.updateRememberedDevice(
      platformSelection.platformName,
      targetName
    );
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
    .withFlag('--loglevel', PreviewService.instance.getLogLevel())
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
      const message = isAndroid
        ? nls.localize('force_lightning_lwc_android_failure', targetUsed)
        : nls.localize('force_lightning_lwc_ios_failure', targetUsed);
      showError(new Error(message), logName, commandName);

      // Error code 127 means the lwc on mobile sfdx plugin is not installed.
      if (exitCode === 127) {
        showError(
          new Error(nls.localize('force_lightning_lwc_no_mobile_plugin')),
          logName,
          commandName
        );
      }
    } else if (!isAndroid) {
      notificationService.showSuccessfulExecution(execution.command.toString());
      vscode.window.showInformationMessage(
        nls.localize('force_lightning_lwc_ios_start', targetUsed)
      );
    }
  });

  // TODO: Remove this when SFDX Plugin launches Android Emulator as separate process.
  // listen for Android Emulator finished
  if (isAndroid) {
    execution.stdoutSubject.subscribe(async data => {
      if (data && data.toString().includes(androidSuccessString)) {
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
