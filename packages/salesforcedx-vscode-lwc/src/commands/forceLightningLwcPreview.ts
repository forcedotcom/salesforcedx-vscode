/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { componentUtil } from '@salesforce/lightning-lsp-common';
import {
  EmptyParametersGatherer,
  notificationService,
  SfdxCommandBuilder,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService } from '../channel';
import { nls } from '../messages';
import { DevServerService } from '../service/devServerService';
import { PreviewService } from '../service/previewService';
import { telemetryService } from '../telemetry';
import { openBrowser, showError } from './commandUtils';
import { ForceLightningLwcStartExecutor } from './forceLightningLwcStart';
import {
  androidPlatform,
  desktopPlatform,
  DevicePlatformType,
  iOSPlatform,
  LWCPlatformQuickPickItem,
  LWCUtils,
  OperationCancelledException
} from './lwcUtils';

export async function forceLightningLwcPreview(sourceUri: vscode.Uri): Promise<void> {
  const logName = 'force_lightning_lwc_preview';
  const commandName = nls.localize('force_lightning_lwc_preview_text');
  const startTime = process.hrtime();
  const resourceUri: vscode.Uri | undefined = sourceUri ?? vscode.window.activeTextEditor?.document.uri;
  const resourcePath: string | undefined = resourceUri?.fsPath;

  if (!resourceUri) {
    return LWCUtils.showFailure(logName, commandName, 'force_lightning_lwc_file_undefined', resourceUri);
  }

  if (!resourcePath) {
    return LWCUtils.showFailure(logName, commandName, 'force_lightning_lwc_file_undefined', resourcePath);
  }

  if (!fs.existsSync(resourcePath)) {
    return LWCUtils.showFailure(logName, commandName, 'force_lightning_lwc_file_nonexist', resourcePath);
  }

  const isSFDX = true; // TODO support non SFDX projects
  const isDirectory = fs.lstatSync(resourcePath).isDirectory();
  const componentName = isDirectory
    ? componentUtil.moduleFromDirectory(resourcePath, isSFDX)
    : componentUtil.moduleFromFile(resourcePath, isSFDX);
  if (!componentName) {
    return LWCUtils.showFailure(logName, commandName, 'force_lightning_lwc_unsupported', resourcePath);
  }

  return executeCommand(logName, commandName, startTime, componentName, resourcePath);
}

/**
 * Performs the action of previewing the LWC. It takes care of prompting the user
 * and gathering all info needed to preview the LWC. This includes prompting the user
 * to select a platform, a target device, a target native app (or browser), etc.
 * Previewing on Android or iOS are handled by the @salesforce/lwc-dev-mobile sfdx package.
 *
 * @param startTime start time of the preview command
 * @param componentName name of the lwc
 * @param resourcePath path to the lwc
 */
async function executeCommand(
  logName: string,
  commandName: string,
  startTime: [number, number],
  componentName: string,
  resourcePath: string
): Promise<void> {
  try {
    // 1. Prompt user to select a platform
    const platformOptions: LWCPlatformQuickPickItem[] = [
      desktopPlatform,
      androidPlatform
    ];
    if (LWCUtils.isMacOS()) {
      platformOptions.push(iOSPlatform);
    }

    const selectedPlatform = await LWCUtils.selectPlatform(platformOptions);
    if (selectedPlatform.id === DevicePlatformType.Desktop) {
      return startServer(true, componentName, logName, commandName, startTime);
    }

    // 2. Prompt user to select a target device for the platform
    const targetDevice = await LWCUtils.selectTargetDevice(selectedPlatform);

    // 3. Determine project root directory and path to the config file (if any)
    const projectRootDir = LWCUtils.getProjectRootDirectory(resourcePath);
    const configFilePath = projectRootDir && path.join(projectRootDir, 'mobile-apps.json');

    // 4. Prompt user to select a target app (if any)
    const targetApp = await selectTargetApp(selectedPlatform, configFilePath);

    // 5. Start the local dev server
    await startServer(false, componentName, logName, commandName, startTime);

    // 6. Preview on mobile device
    await executeMobilePreview(
      selectedPlatform,
      targetDevice,
      targetApp,
      projectRootDir,
      configFilePath,
      componentName,
      logName,
      commandName,
      startTime
    );

    notificationService.showSuccessfulExecution(commandName, channelService).catch();
    const message = selectedPlatform.id === DevicePlatformType.Android
      ? nls.localize('force_lightning_lwc_android_start', targetDevice)
      : nls.localize('force_lightning_lwc_ios_start', targetDevice);
    vscode.window.showInformationMessage(message);
  } catch (err) {
    if (err instanceof OperationCancelledException) {
      vscode.window.showWarningMessage(err.message);
    } else {
      showError(err, logName, commandName);
    }
  }
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
  logName: string,
  commandName: string,
  startTime: [number, number]
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      if (!DevServerService.instance.isServerHandlerRegistered()) {
        const preconditionChecker = new SfdxWorkspaceChecker();
        const parameterGatherer = new EmptyParametersGatherer();
        const executor = new ForceLightningLwcStartExecutor(
          { openBrowser: isDesktop, componentName },
          () => { resolve(); },
          () => { reject(); }
        );

        const commandlet = new SfdxCommandlet(
          preconditionChecker,
          parameterGatherer,
          executor
        );

        await commandlet.run();
        telemetryService.sendCommandEvent(logName, startTime);
      } else if (isDesktop) {
        const fullUrl = DevServerService.instance.getComponentPreviewUrl(
          componentName
        );
        const success = await openBrowser(fullUrl);
        if (success) {
          resolve();
        } else {
          reject();
        }
        telemetryService.sendCommandEvent(logName, startTime);
      } else {
        resolve();
      }
    } catch (err) {
      showError(err, logName, commandName);
      reject(err);
    }
  });
}

/**
 * Prompts the user to select an app to preview the LWC on. Defaults to browser.
 *
 * @param platformSelection the selected platform
 * @param configFile path to a config file
 * @returns the name of the selected device or undefined if user cancels selection.
 */
async function selectTargetApp(
  platformSelection: LWCPlatformQuickPickItem,
  configFile: string | undefined
): Promise<string> {
  let targetApp: string = 'browser';
  const items = LWCUtils.getAppOptionsFromPreviewConfigFile(
    platformSelection,
    configFile
  );

  if (items.length === 0) {
    return targetApp;
  }

  const browserItem: vscode.QuickPickItem = {
    label: nls.localize('force_lightning_lwc_browserapp_label'),
    detail: nls.localize('force_lightning_lwc_browserapp_description')
  };
  items.unshift(browserItem);

  const selectedItem = await LWCUtils.selectItem(items, nls.localize('force_lightning_lwc_select_target_app'));

  // if user did not select the browser option then take the app id
  // from the detail property of the selected item
  if (selectedItem !== browserItem) {
    targetApp = selectedItem.detail ?? '';
  }

  return targetApp;
}

/**
 * Prompts the user to select a device to preview the LWC on.
 *
 * @param platformSelection the selected platform
 * @param targetDevice the selected device
 * @param targetApp the id of the native app to preview the component in, or browser
 * @param projectDir the path to the project root directory
 * @param configFile the path to the preview config file
 * @param componentName name of the component to preview
 * @param startTime start time of the preview command
 */
async function executeMobilePreview(
  platformSelection: LWCPlatformQuickPickItem,
  targetDevice: string,
  targetApp: string,
  projectDir: string | undefined,
  configFile: string | undefined,
  componentName: string,
  logName: string,
  commandName: string,
  startTime: [number, number]
): Promise<void> {
  return new Promise((resolve, reject) => {
    const isAndroid = platformSelection.id === DevicePlatformType.Android;
    const sfdxMobilePreviewCommand = 'force:lightning:lwc:preview';

    let commandBuilder = new SfdxCommandBuilder()
      .withDescription(commandName)
      .withArg(sfdxMobilePreviewCommand)
      .withFlag('-p', platformSelection.platformName)
      .withFlag('-t', targetDevice)
      .withFlag('-n', componentName)
      .withFlag('-a', targetApp);

    if (projectDir) {
      commandBuilder = commandBuilder.withFlag('-d', projectDir);
    }

    if (configFile && targetApp !== 'browser') {
      commandBuilder = commandBuilder.withFlag('-f', configFile);
    }

    const previewCommand = commandBuilder
      .withFlag('--loglevel', PreviewService.instance.getLogLevel())
      .build();

    const onError = () => {
      const message = isAndroid
        ? nls.localize('force_lightning_lwc_android_failure', targetDevice)
        : nls.localize('force_lightning_lwc_ios_failure', targetDevice);
      reject(new Error(message));
    };

    const onSuccess = () => {
      resolve();
    };

    LWCUtils.executeSFDXCommand(previewCommand, logName, startTime, isAndroid, onSuccess, onError);
  });
}
