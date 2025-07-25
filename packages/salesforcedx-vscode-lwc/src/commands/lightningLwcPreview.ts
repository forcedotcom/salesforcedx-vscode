/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// leaving as is because this extension is being replaced
/* eslint-disable @typescript-eslint/consistent-type-assertions */

import { componentUtil } from '@salesforce/lightning-lsp-common';
import { CommandOutput, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import {
  notificationService,
  CliCommandExecutor,
  EmptyParametersGatherer,
  isSFContainerMode,
  SfCommandlet,
  SfWorkspaceChecker,
  stat as getFileStats,
  readFile,
  fileOrFolderExists,
  TimingUtils
} from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { channelService } from '../channel';
import { nls } from '../messages';
import { DevServerService } from '../service/devServerService';
import { PreviewService } from '../service/previewService';
import { telemetryService } from '../telemetry';
import { openBrowser, showError } from './commandUtils';
import { LightningLwcStartExecutor } from './lightningLwcStart';

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

type IOSSimulatorDevice = {
  name: string;
  udid: string;
  state: string;
  runtimeId: string;
  isAvailable: boolean;
};

type AndroidVirtualDevice = {
  name: string;
  displayName: string;
  deviceName: string;
  path: string;
  target: string;
  api: string;
};

type PreviewQuickPickItem = vscode.QuickPickItem & {
  label: string;
  detail: string;
  alwaysShow: boolean;
  picked: boolean;
  id: PreviewPlatformType;
  defaultTargetName: string;
  platformName: keyof typeof PlatformName;
};

type DeviceQuickPickItem = vscode.QuickPickItem & {
  name: string;
};

const platformOptions: PreviewQuickPickItem[] = [
  {
    label: nls.localize('lightning_lwc_preview_desktop_label'),
    detail: nls.localize('lightning_lwc_preview_desktop_description'),
    alwaysShow: true,
    picked: true,
    id: PreviewPlatformType.Desktop,
    platformName: PlatformName.Desktop,
    defaultTargetName: ''
  },
  {
    label: nls.localize('lightning_lwc_android_label'),
    detail: nls.localize('lightning_lwc_android_description'),
    alwaysShow: true,
    picked: false,
    id: PreviewPlatformType.Android,
    platformName: PlatformName.Android,
    defaultTargetName: 'SFDXEmulator'
  },
  {
    label: nls.localize('lightning_lwc_ios_label'),
    detail: nls.localize('lightning_lwc_ios_description'),
    alwaysShow: true,
    picked: false,
    id: PreviewPlatformType.iOS,
    platformName: PlatformName.iOS,
    defaultTargetName: 'SFDXSimulator'
  }
];

const logName = 'lightning_lwc_preview';
const commandName = nls.localize('lightning_lwc_preview_text');
const sfDeviceListCommand = 'force:lightning:local:device:list';
const sfMobilePreviewCommand = 'force:lightning:lwc:preview';
const androidSuccessString = 'Launching... Opening Browser';

export const lightningLwcPreview = async (sourceUri: URI) => {
  const preview = getPreview();
  await preview(sourceUri);
};

export const getPreview = () => {
  if (isSFContainerMode()) {
    return lwcPreviewContainerMode;
  } else {
    return lwcPreview;
  }
};

const lwcPreviewContainerMode = () => {
  const message = nls.localize('lightning_lwc_preview_container_mode');
  vscode.window.showErrorMessage(message);
};

const lwcPreview = async (sourceUri: URI) => {
  const startTime = TimingUtils.getCurrentTime();

  const resolved =
    sourceUri ?? (vscode.window.activeTextEditor ? URI.from(vscode.window.activeTextEditor.document.uri) : undefined);

  if (!resolved) {
    const message = nls.localize('lightning_lwc_preview_file_undefined', resolved);
    showError(new Error(message), logName, commandName);
    return;
  }
  const resourcePath = resolved.fsPath;
  if (!resourcePath) {
    const message = nls.localize('lightning_lwc_preview_file_undefined', resourcePath);
    showError(new Error(message), logName, commandName);
    return;
  }

  try {
    const fileStats = await getFileStats(resourcePath);
    const isSFDX = true; // TODO support non SFDX Projects
    const isDirectory = fileStats.type === vscode.FileType.Directory;
    const componentName = isDirectory
      ? componentUtil.moduleFromDirectory(resourcePath, isSFDX)
      : componentUtil.moduleFromFile(resourcePath, isSFDX);
    if (!componentName) {
      const message = nls.localize('lightning_lwc_preview_unsupported', resourcePath);
      showError(new Error(message), logName, commandName);
      return;
    }

    await executePreview(startTime, componentName, resourcePath);
  } catch {
    const message = nls.localize('lightning_lwc_preview_file_nonexist', resourcePath);
    showError(new Error(message), logName, commandName);
  }
};

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
const executePreview = async (startTime: number, componentName: string, resourcePath: string) => {
  const commandCancelledMessage = nls.localize('lightning_lwc_operation_cancelled');

  // 1. Prompt user to select a platform
  const platformSelection = await selectPlatform();
  if (!platformSelection) {
    vscode.window.showWarningMessage(commandCancelledMessage);
    return;
  }

  if (platformSelection.id === PreviewPlatformType.Desktop) {
    await startServer(true, componentName, startTime);
    return;
  }

  // 2. Prompt user to select a target device
  let targetDevice: string;
  try {
    const targetName = await selectTargetDevice(platformSelection);
    if (targetName === undefined) {
      vscode.window.showInformationMessage(commandCancelledMessage);
      return;
    } else {
      targetDevice = targetName;
    }
  } catch {
    // exception has already been logged
    return;
  }

  // 3. Determine project root directory and path to the config file
  const projectRootDir = await getProjectRootDirectory(resourcePath);
  const configFilePath = projectRootDir && path.join(projectRootDir, 'mobile-apps.json');

  // 4. Prompt user to select a target app (if any)
  const targetApp = await selectTargetApp(platformSelection, configFilePath);
  if (targetApp === undefined) {
    vscode.window.showInformationMessage(commandCancelledMessage);
    return;
  }

  await startServer(false, componentName, startTime);

  // 5. Preview on mobile device
  await executeMobilePreview(
    platformSelection,
    targetDevice,
    targetApp,
    projectRootDir,
    configFilePath,
    componentName,
    startTime
  );
};

/**
 * Starts the lwc server if it is not already running.
 *
 * @param isDesktop if desktop browser is selected
 * @param componentName name of the component to preview
 * @param startTime start time of the preview command
 */
const startServer = async (isDesktop: boolean, componentName: string, startTime: number) => {
  if (!DevServerService.instance.isServerHandlerRegistered()) {
    console.log(`${logName}: server was not running, starting...`);
    const preconditionChecker = new SfWorkspaceChecker();
    const parameterGatherer = new EmptyParametersGatherer();
    const executor = new LightningLwcStartExecutor({
      openBrowser: isDesktop,
      componentName
    });

    const commandlet = new SfCommandlet(preconditionChecker, parameterGatherer, executor);

    await commandlet.run();
    telemetryService.sendCommandEvent(logName, startTime);
  } else if (isDesktop) {
    try {
      const fullUrl = DevServerService.instance.getComponentPreviewUrl(componentName);
      await openBrowser(fullUrl);
      telemetryService.sendCommandEvent(logName, startTime);
    } catch (e) {
      showError(e, logName, commandName);
    }
  }
};

/**
 * Prompts the user to select a platform to preview the LWC on.
 * @returns the selected platform or undefined if no selection was made.
 */
const selectPlatform = async (): Promise<PreviewQuickPickItem | undefined> => {
  const platformSelection = await vscode.window.showQuickPick(platformOptions, {
    placeHolder: nls.localize('lightning_lwc_platform_selection')
  });

  return platformSelection;
};

/**
 * Prompts the user to select a device to preview the LWC on.
 *
 * @param platformSelection the selected platform
 * @returns the name of the selected device or undefined if no selection was made.
 */
const selectTargetDevice = async (platformSelection: PreviewQuickPickItem): Promise<string | undefined> => {
  const isAndroid = platformSelection.id === PreviewPlatformType.Android;
  const lastTarget = PreviewService.instance.getRememberedDevice(platformSelection.platformName);
  let target: string | undefined = platformSelection.defaultTargetName;
  let createDevicePlaceholderText = isAndroid
    ? nls.localize('lightning_lwc_android_target_default')
    : nls.localize('lightning_lwc_ios_target_default');

  // Remember device setting enabled and previous device retrieved.
  if (PreviewService.instance.isRememberedDeviceEnabled() && lastTarget) {
    const message = isAndroid ? 'lightning_lwc_android_target_remembered' : 'lightning_lwc_ios_target_remembered';
    createDevicePlaceholderText = nls.localize(message, lastTarget);
    target = lastTarget;
  }

  const deviceListOutput = new CommandOutput();
  const deviceListCommand = new SfCommandBuilder()
    .withArg(sfDeviceListCommand)
    .withFlag('-p', platformSelection.platformName)
    .withJson()
    .build();

  let deviceListExecutionExitCode: number | undefined;
  const deviceListCancellationTokenSource = new vscode.CancellationTokenSource();
  const deviceListCancellationToken = deviceListCancellationTokenSource.token;
  const deviceListExecutor = new CliCommandExecutor(deviceListCommand, {});
  const deviceListExecution = deviceListExecutor.execute(deviceListCancellationToken);
  deviceListExecution.processExitSubject.subscribe(exitCode => {
    deviceListExecutionExitCode = exitCode;
  });

  const items: DeviceQuickPickItem[] = [];
  const createNewDeviceItem: DeviceQuickPickItem = {
    label: nls.localize('lightning_lwc_preview_create_virtual_device_label'),
    detail: nls.localize('lightning_lwc_preview_create_virtual_device_detail'),
    name: nls.localize('lightning_lwc_preview_create_virtual_device_label')
  };
  let targetName: string | undefined;

  try {
    const result: string = await deviceListOutput.getCmdResult(deviceListExecution);

    const jsonString: string = result.substring(result.indexOf('{'));

    // populate quick pick list of devices from the parsed JSON data
    if (isAndroid) {
      const devices: AndroidVirtualDevice[] = JSON.parse(jsonString).result as AndroidVirtualDevice[];
      devices.forEach(device => {
        const label: string = device.displayName;
        const detail: string = `${device.target}, ${device.api}`;
        const name: string = device.name;
        items.push({ label, detail, name });
      });
    } else {
      const devices: IOSSimulatorDevice[] = JSON.parse(jsonString).result as IOSSimulatorDevice[];
      devices.forEach(device => {
        const label: string = device.name;
        const detail: string = device.runtimeId;
        const name: string = device.name;
        items.push({ label, detail, name });
      });
    }
  } catch (e) {
    // If device enumeration fails due to exit code 127
    // (i.e. lwc on mobile sfdx plugin is not installed)
    // then show an error message and exit. For other reasons,
    // silently fail and proceed with an empty list of devices.
    const error = String(e) || '';
    if (deviceListExecutionExitCode === 127 || error.includes('not a sf command')) {
      showError(new Error(nls.localize('lightning_lwc_no_mobile_plugin')), logName, commandName);
      throw e;
    }
  }

  // if there are any devices available, show a pick list.
  let selectedItem: DeviceQuickPickItem | undefined;
  if (items.length > 0) {
    items.unshift(createNewDeviceItem);

    selectedItem = await vscode.window.showQuickPick(items, {
      placeHolder: nls.localize('lightning_lwc_preview_select_virtual_device')
    });

    if (selectedItem === undefined) {
      // user cancelled operation
      return undefined;
    } else {
      targetName = selectedItem.name;
    }
  }

  // if there are no devices available or user chooses to create
  // a new device then show an inputbox and ask for further info.
  if (targetName === undefined || selectedItem === createNewDeviceItem) {
    targetName = await vscode.window.showInputBox({
      placeHolder: createDevicePlaceholderText
    });

    if (targetName === undefined) {
      // user cancelled operation
      return undefined;
    }
  }

  // new target device entered
  if (targetName && targetName !== '') {
    PreviewService.instance.updateRememberedDevice(platformSelection.platformName, targetName);

    target = targetName;
  }

  return target;
};

/**
 * Prompts the user to select an app to preview the LWC on. Defaults to browser.
 *
 * @param platformSelection the selected platform
 * @param configFile path to a config file
 * @returns the name of the selected device or undefined if user cancels selection.
 */
const selectTargetApp = async (
  platformSelection: PreviewQuickPickItem,
  configFile: string | undefined
): Promise<string | undefined> => {
  let targetApp: string | undefined = 'browser';
  const items: vscode.QuickPickItem[] = [];
  const browserItem: vscode.QuickPickItem = {
    label: nls.localize('lightning_lwc_browserapp_label'),
    detail: nls.localize('lightning_lwc_browserapp_description')
  };

  if (configFile === undefined) {
    return targetApp;
  }

  try {
    if (await fileOrFolderExists(configFile)) {
      const fileContent = await readFile(configFile);
      const json = JSON.parse(fileContent);
      const appDefinitionsForSelectedPlatform =
        platformSelection.id === PreviewPlatformType.Android ? json.apps.android : json.apps.ios;

      const apps = Array.from<any>(appDefinitionsForSelectedPlatform);

      apps.forEach(app => {
        const label: string = app.name;
        const detail: string = app.id;
        items.push({ label, detail });
      });
    }
  } catch {
    // silently fail and default to previewing on browser
    return targetApp;
  }

  // if there are any devices available, show a pick list.
  if (items.length > 0) {
    items.unshift(browserItem);

    const selectedItem = await vscode.window.showQuickPick(items, {
      placeHolder: nls.localize('lightning_lwc_preview_select_target_app')
    });

    if (selectedItem) {
      // if user did not select the browser option then take the app id
      // from the detail property of the selected item
      if (selectedItem !== browserItem) {
        targetApp = selectedItem.detail;
      }
    } else {
      // user cancelled operation
      targetApp = undefined;
    }
  }

  return targetApp;
};

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
const executeMobilePreview = async (
  platformSelection: PreviewQuickPickItem,
  targetDevice: string,
  targetApp: string,
  projectDir: string | undefined,
  configFile: string | undefined,
  componentName: string,
  startTime: number
) => {
  const isAndroid = platformSelection.id === PreviewPlatformType.Android;

  let commandBuilder = new SfCommandBuilder()
    .withDescription(commandName)
    .withArg(sfMobilePreviewCommand)
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

  const previewCommand = commandBuilder.withFlag('--loglevel', PreviewService.instance.getLogLevel()).build();

  const previewExecutor = new CliCommandExecutor(previewCommand, {
    env: { SF_JSON_TO_STDOUT: 'true' }
  });
  const previewCancellationTokenSource = new vscode.CancellationTokenSource();
  const previewCancellationToken = previewCancellationTokenSource.token;
  const previewExecution = previewExecutor.execute(previewCancellationToken);
  telemetryService.sendCommandEvent(logName, startTime);
  channelService.streamCommandOutput(previewExecution);
  channelService.showChannelOutput();

  previewExecution.processExitSubject.subscribe(async exitCode => {
    if (exitCode !== 0) {
      const message = isAndroid
        ? nls.localize('lightning_lwc_android_failure', targetDevice)
        : nls.localize('lightning_lwc_ios_failure', targetDevice);
      showError(new Error(message), logName, commandName);
    } else if (!isAndroid) {
      await notificationService.showSuccessfulExecution(previewExecution.command.toString(), channelService).catch();
      vscode.window.showInformationMessage(nls.localize('lightning_lwc_ios_start', targetDevice));
    }
  });

  // TODO: Remove this when SFDX Plugin launches Android Emulator as separate process.
  // listen for Android Emulator finished
  if (isAndroid) {
    previewExecution.stdoutSubject.subscribe(async data => {
      if (data?.toString().includes(androidSuccessString)) {
        await notificationService.showSuccessfulExecution(previewExecution.command.toString(), channelService).catch();
        vscode.window.showInformationMessage(nls.localize('lightning_lwc_android_start', targetDevice));
      }
    });
  }
};

/**
 * Given a path, it recursively goes through that directory and upwards, until it finds
 * a config file named sfdx-project.json and returns the path to the folder containg it.
 *
 * @param startPath starting path to search for the config file.
 * @returns the path to the folder containing the config file, or undefined if config file not found
 */
const getProjectRootDirectory = async (startPath: string): Promise<string | undefined> => {
  try {
    const startStats = await getFileStats(startPath);
    const searchingForFile = 'sfdx-project.json';
    let dir: string | undefined = startStats.type === vscode.FileType.Directory ? startPath : path.dirname(startPath);
    while (dir) {
      const fileName = path.join(dir, searchingForFile);
      try {
        await getFileStats(fileName);
        return dir;
      } catch {
        // File doesn't exist, continue searching
      }
      dir = directoryLevelUp(dir);
    }

    // couldn't determine the root dir
    return undefined;
  } catch {
    return undefined;
  }
};

/**
 * Given a path to a directory, returns a path that is one level up.
 *
 * @param directory path to a directory
 * @returns path to a directory that is one level up, or undefined if cannot go one level up.
 */
const directoryLevelUp = (directory: string): string | undefined => {
  const levelUp = path.dirname(directory);

  if (levelUp === directory) {
    // we're at the root and can't go any further up
    return undefined;
  }

  return levelUp;
};
