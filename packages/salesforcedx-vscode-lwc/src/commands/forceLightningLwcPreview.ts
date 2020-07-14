/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { componentUtil } from '@salesforce/lightning-lsp-common';
import {
  CliCommandExecutor,
  CommandOutput,
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
  SfdxWorkspaceChecker
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
const sfdxDeviceListCommand = 'force:lightning:local:device:list';
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
  const createDeviceLabelText = nls.localize(
    'force_lightning_lwc_preview_create_virtual_device_label'
  );
  const createDeviceDetailText = nls.localize(
    'force_lightning_lwc_preview_create_virtual_device_detail'
  );
  const selectDevicePlaceholderText = nls.localize(
    'force_lightning_lwc_preview_select_virtual_device'
  );
  let createDevicePlaceholderText = isAndroid
    ? nls.localize('force_lightning_lwc_android_target_default')
    : nls.localize('force_lightning_lwc_ios_target_default');
  const commandCancelledMessage = isAndroid
    ? nls.localize('force_lightning_lwc_android_device_cancelled')
    : nls.localize('force_lightning_lwc_ios_device_cancelled');
  const lastTarget = PreviewService.instance.getRememberedDevice(
    platformSelection.platformName
  );

  // Remember device setting enabled and previous device retrieved.
  if (PreviewService.instance.isRememberedDeviceEnabled() && lastTarget) {
    const message = isAndroid
      ? 'force_lightning_lwc_android_target_remembered'
      : 'force_lightning_lwc_ios_target_remembered';
    createDevicePlaceholderText = nls.localize(message, lastTarget);
    target = lastTarget;
  }

  const deviceListOutput = new CommandOutput();
  const deviceListCommand = new SfdxCommandBuilder()
    .withArg(sfdxDeviceListCommand)
    .withFlag('-p', platformSelection.platformName)
    .withJson()
    .build();

  const mobileCancellationTokenSource = new vscode.CancellationTokenSource();
  const mobileCancellationToken = mobileCancellationTokenSource.token;
  const deviceListExecutor = new CliCommandExecutor(deviceListCommand, {});
  const deviceListExecution = deviceListExecutor.execute(
    mobileCancellationToken
  );

  const options: vscode.QuickPickItem[] = [];
  let targetName: string | undefined;
  try {
    const result = await deviceListOutput.getCmdResult(deviceListExecution);
    const jsonString = result.substring(result.indexOf('{'));
    const json = JSON.parse(jsonString);
    const devices = json.result as any[];

    devices.forEach(device => {
      const label = isAndroid ? device.displayName : device.name;
      const detail = isAndroid
        ? `${device.target}, ${device.api}`
        : device.runtimeId;
      options.push({ label, detail });
    });
  } catch (e) {
    // If device enumeration failes for any reason, we silently fail
    // and proceed with an empty list of devices.
  }

  // if there are any devices available, show a pick list.
  if (options.length > 0) {
    options.unshift({
      label: createDeviceLabelText,
      detail: createDeviceDetailText
    });

    const selectedItem = await vscode.window.showQuickPick(options, {
      placeHolder: selectDevicePlaceholderText
    });
    targetName = selectedItem && selectedItem.label;

    if (targetName === undefined) {
      vscode.window.showInformationMessage(commandCancelledMessage);
      return;
    }
  }

  // if there are no devices available or user chooses to create
  // a new device then show an inputbox and ask for further info.
  if (targetName === undefined || targetName === createDeviceLabelText) {
    targetName = await vscode.window.showInputBox({
      placeHolder: createDevicePlaceholderText
    });

    if (targetName === undefined) {
      vscode.window.showInformationMessage(commandCancelledMessage);
      return;
    }
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

  const previewCommand = new SfdxCommandBuilder()
    .withDescription(commandName)
    .withArg(sfdxMobilePreviewCommand)
    .withFlag('-p', platformSelection.platformName)
    .withFlag('-t', target)
    .withFlag('-n', componentName)
    .withFlag('--loglevel', PreviewService.instance.getLogLevel())
    .build();

  const previewExecutor = new CliCommandExecutor(previewCommand, {
    env: { SFDX_JSON_TO_STDOUT: 'true' }
  });
  const previewExecution = previewExecutor.execute(mobileCancellationToken);
  telemetryService.sendCommandEvent(logName, startTime);
  channelService.streamCommandOutput(previewExecution);
  channelService.showChannelOutput();

  previewExecution.processExitSubject.subscribe(async exitCode => {
    if (exitCode !== 0) {
      const message = isAndroid
        ? nls.localize('force_lightning_lwc_android_failure', target)
        : nls.localize('force_lightning_lwc_ios_failure', target);
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
      notificationService.showSuccessfulExecution(
        previewExecution.command.toString()
      );
      vscode.window.showInformationMessage(
        nls.localize('force_lightning_lwc_ios_start', target)
      );
    }
  });

  // TODO: Remove this when SFDX Plugin launches Android Emulator as separate process.
  // listen for Android Emulator finished
  if (isAndroid) {
    previewExecution.stdoutSubject.subscribe(async data => {
      if (data && data.toString().includes(androidSuccessString)) {
        notificationService.showSuccessfulExecution(
          previewExecution.command.toString()
        );
        vscode.window.showInformationMessage(
          nls.localize('force_lightning_lwc_android_start', target)
        );
      }
    });
  }
}
