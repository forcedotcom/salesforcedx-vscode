/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService } from '../channel';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';
import { showError } from './commandUtils';

export class OperationCancelledException extends Error {
  constructor() {
    const commandCancelledMessage = nls.localize(
      'force_lightning_lwc_operation_cancelled'
    );
    super(commandCancelledMessage);
    // Set the prototype explicitly
    Object.setPrototypeOf(this, OperationCancelledException.prototype);
  }
}

export const enum DevicePlatformType {
  Desktop = 1,
  Android,
  iOS
}

export const enum DevicePlatformName {
  Desktop = 'Desktop',
  Android = 'Android',
  iOS = 'iOS'
}

export const enum FileBrowseKind {
  Open = 1, // Use vscode.window.showOpenDialog() when browsing for file
  Save = 2  // Use vscode.window.showSaveDialog() when browsing for file
}

export interface LWCPlatformQuickPickItem extends vscode.QuickPickItem {
  id: DevicePlatformType;
  defaultTargetName: string;
  platformName: keyof typeof DevicePlatformName;
}

export interface DeviceQuickPickItem extends vscode.QuickPickItem {
  name: string;
}

export interface IOSSimulatorDevice {
  name: string;
  udid: string;
  state: string;
  runtimeId: string;
  isAvailable: boolean;
}

export interface AndroidVirtualDevice {
  name: string;
  displayName: string;
  deviceName: string;
  path: string;
  target: string;
  api: string;
}

export interface InputBoxButton {
  button: vscode.QuickInputButton;
  callback: (parent: vscode.InputBox) => Promise<void>;
}

export const desktopPlatform: LWCPlatformQuickPickItem = {
  label: nls.localize('force_lightning_lwc_desktop_label'),
  detail: nls.localize('force_lightning_lwc_desktop_description'),
  alwaysShow: true,
  picked: true,
  id: DevicePlatformType.Desktop,
  platformName: DevicePlatformName.Desktop,
  defaultTargetName: ''
};

export const iOSPlatform: LWCPlatformQuickPickItem = {
  label: nls.localize('force_lightning_lwc_ios_label'),
  detail: nls.localize('force_lightning_lwc_ios_description'),
  alwaysShow: true,
  picked: false,
  id: DevicePlatformType.iOS,
  platformName: DevicePlatformName.iOS,
  defaultTargetName: 'sfdxdebug'
};

export const androidPlatform: LWCPlatformQuickPickItem = {
  label: nls.localize('force_lightning_lwc_android_label'),
  detail: nls.localize('force_lightning_lwc_android_description'),
  alwaysShow: true,
  picked: false,
  id: DevicePlatformType.Android,
  platformName: DevicePlatformName.Android,
  defaultTargetName: 'sfdxdebug'
};

export class LWCUtils {
  /**
   * Checks whether the current process is running on Mac OS.
   *
   * @return A boolean indicating whether the current process is running on Mac OS.
   */
  public static isMacOS(): boolean {
    return process.platform === 'darwin';
  }

  /**
   * Takes a file path and converts it to a UNIX file path.
   *
   * @param filePath A file path.
   * @return A string containg the file path in UNIX path style.
   */
  public static convertToUnixPath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }

  /**
   * Sends an error to telemetryService + notificationService + channelService, and
   * returns a rejected promise containing the error object.
   *
   * @param logName The name of the logger to be used.
   * @param commandName The name of the command that has encountered the failure.
   * @param errorMessageKey The key to be used for fetching a localized error message.
   * @param errorMessageArgument The extra argument to be used with the localized error message.
   */
  public static showFailure(
    logName: string,
    commandName: string,
    errorMessageKey: string,
    errorMessageArgument: string
  ): Promise<void> {
    const message = nls.localize(errorMessageKey, errorMessageArgument);
    const error = new Error(message);
    showError(error, logName, commandName);
    return Promise.reject(error);
  }

  /**
   * Shows a selection list and waits for user to pick one of the items in the list.
   *
   * @param items An array of items.
   * @param placeholder The placeholder text to be used.
   * @return A promise that resolves to the selected item.
   */
  public static async selectItem<T extends vscode.QuickPickItem>(
    items: readonly T[],
    placeholder: string
  ): Promise<T> {
    if (items.length === 1) {
      return Promise.resolve(items[0]);
    }

    const selectedItem = await vscode.window.showQuickPick(items, {
      placeHolder: placeholder,
      ignoreFocusOut: true
    });
    if (selectedItem === undefined) {
      // user cancelled the operation
      return Promise.reject(new OperationCancelledException());
    } else {
      return Promise.resolve(selectedItem);
    }
  }

  /**
   * Validates an input string and returns an error message if validation fails or undefined if no validation errors.
   *
   * @param text The input string.
   * @param allowEmptyInput Indicates whether an empty/whitespace/null string is considered as valid input.
   * @param acceptNumericOnly Indicates whether only numeric input is acceptable.
   * @return An error message if validation fails or undefined if no validation errors.
   */
  public static validateString(
    text: string | undefined,
    allowEmptyInput: boolean,
    acceptNumericOnly: boolean
  ): string | undefined {
      const input = text?.trim() ?? '';
      let errorMessage: string | undefined = nls.localize('user_input_invalid');

      if (input.length > 0) {
        if (acceptNumericOnly) {
          const isNumeric = !isNaN(Number(input));
          if (isNumeric) {
            errorMessage = undefined;
          }
        } else {
          errorMessage = undefined;
        }
      } else if (allowEmptyInput) {
        errorMessage = undefined;
      }

      return errorMessage;
  }

  /**
   * Opens an input box to ask the user for input.
   *
   * @param title An optional string to show as the title of the input box.
   * @param placeholder An optional string to show as the placeholder text of the input box.
   * @param buttons An optional array of buttons to show on the input box title bar.
   * @param allowEmptyInput Indicates whether an empty/whitespace string is considered as valid input.
   * @param acceptNumericOnly Indicates whether only numeric input is acceptable.
   * @return A promise that resolves to a string the user provided.
   */
  public static async getUserInput(
    title: string | undefined,
    placeholder: string | undefined,
    buttons?: InputBoxButton[],
    allowEmptyInput: boolean = false,
    acceptNumericOnly: boolean = false
  ): Promise<string> {
    let input = await new Promise<string | undefined>((resolve, reject) => {
      let userInput: string | undefined;

      const inputBox = vscode.window.createInputBox();
      inputBox.title = title;
      inputBox.placeholder =  placeholder;
      inputBox.ignoreFocusOut = true;

      if (buttons && buttons.length > 0) {
        inputBox.buttons = buttons.map(item => item.button);
      }

      inputBox.onDidTriggerButton(async button => {
        const btn = buttons?.find(item => item.button === button);
        if (btn) {
          await btn.callback(inputBox);
        }
      });
      inputBox.onDidAccept(() => {
        inputBox.validationMessage = LWCUtils.validateString(inputBox.value, allowEmptyInput, acceptNumericOnly);
        if (!inputBox.validationMessage) {
          userInput = inputBox.value;
          inputBox.dispose();
        }
      });
      inputBox.onDidHide(() => {
        resolve(userInput);
      });
      inputBox.show();
    });

    input = input?.trim();
    if (input === undefined || input === null) {
      // user cancelled the operation
      return Promise.reject(new OperationCancelledException());
    } else {
      return Promise.resolve(input);
    }
  }

  /**
   * Opens an input box to ask the user to provide the path to a file. It also includes a 'browse'
   * button so that the user can browse for a file instead of typing the path.
   *
   * @param title An optional string to show as the title of the input box.
   * @param placeholder An optional string to show as the placeholder text of the input box.
   * @param browseKind Indicates whether an Open or Save dialog should be displayed.
   * @param allowEmptyInput Indicates whether an empty/whitespace string is considered as valid input.
   * @param defaultPath The default path to be used when showing Open/Save dialog.
   * @param themeIconId A ThemeIcon id to be used to fetch an icon for the browse button.
   * @return A promise that resolves to a string the user provided.
   */
  public static async getFilePath(
    title: string | undefined,
    placeholder: string | undefined,
    browseKind: FileBrowseKind,
    allowEmptyInput: boolean = false,
    defaultPath?: string | undefined,
    themeIconId: string = 'folder-opened'
  ): Promise<string> {
    const browseButton: InputBoxButton = {
      button: {
        iconPath: LWCUtils.getThemeIcon(themeIconId),
        tooltip: nls.localize('force_lightning_lwc_file_browse')
      },

      callback: async (parent: vscode.InputBox) => {
        let fileUri: vscode.Uri[] | undefined;

        if (browseKind === FileBrowseKind.Open) {
          const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            defaultUri: defaultPath ? vscode.Uri.file(defaultPath) : undefined
          };
          fileUri = await vscode.window.showOpenDialog(options);
        } else {
          const options: vscode.SaveDialogOptions = {
            defaultUri: defaultPath ? vscode.Uri.file(defaultPath) : undefined
          };
          const uri = await vscode.window.showSaveDialog(options);
          if (uri) {
            fileUri = [uri];
          }
        }

        if (fileUri && fileUri[0]) {
          parent.value = fileUri[0].fsPath;
          parent.validationMessage = undefined;
        }
      }
    };

    return LWCUtils.getUserInput(title, placeholder, [browseButton], allowEmptyInput);
  }

  // helper method (added to simplify jest testing of getFilePath)
  public static getThemeIcon(id: string): vscode.ThemeIcon | vscode.Uri {
    return new vscode.ThemeIcon(id);
  }

  /**
   * Prompts the user to select a platform from the provided options.
   * @returns the selected platform.
   */
  public static async selectPlatform(
    platformOptions: LWCPlatformQuickPickItem[]
  ): Promise<LWCPlatformQuickPickItem> {
    return LWCUtils.selectItem(platformOptions, nls.localize('force_lightning_lwc_platform_selection'));
  }

  /**
   * Given a specific platform, it returns a list available devices
   * for that platform.
   * @returns the list of available devices.
   */
  public static async getDeviceList(
    platformSelection: LWCPlatformQuickPickItem
  ): Promise<DeviceQuickPickItem[]> {
    const sfdxDeviceListCommand = 'force:lightning:local:device:list';

    const deviceListOutput = new CommandOutput();
    const deviceListCommand = new SfdxCommandBuilder()
      .withArg(sfdxDeviceListCommand)
      .withFlag('-p', platformSelection.platformName)
      .withJson()
      .build();

    let deviceListExecutionExitCode: number | undefined;
    const deviceListCancellationTokenSource = new vscode.CancellationTokenSource();
    const deviceListCancellationToken = deviceListCancellationTokenSource.token;
    const deviceListExecutor = new CliCommandExecutor(deviceListCommand, {});
    const deviceListExecution = deviceListExecutor.execute(
      deviceListCancellationToken
    );
    deviceListExecution.processExitSubject.subscribe(exitCode => {
      deviceListExecutionExitCode = exitCode;
    });

    const items: DeviceQuickPickItem[] = [];

    try {
      const result = await deviceListOutput.getCmdResult(
        deviceListExecution
      );

      const jsonString: string = result.substring(result.indexOf('{'));

      const isAndroid = platformSelection.id === DevicePlatformType.Android;

      // populate quick pick list of devices from the parsed JSON data
      if (isAndroid) {
        const devices: AndroidVirtualDevice[] = JSON.parse(jsonString)
          .result as AndroidVirtualDevice[];
        devices.forEach(device => {
          const label: string = device.displayName;
          const detail: string = `${device.target}, ${device.api}`;
          const name: string = device.name;
          items.push({ label, detail, name });
        });
      } else {
        const devices: IOSSimulatorDevice[] = JSON.parse(jsonString)
          .result as IOSSimulatorDevice[];
        devices.forEach(device => {
          const label: string = device.name;
          const detail: string = device.runtimeId;
          const name: string = device.udid;
          items.push({ label, detail, name });
        });
      }
    } catch (e) {
      // If device enumeration fails due to exit code 127
      // (i.e. lwc on mobile sfdx plugin is not installed)
      // then show an error message and exit. For other reasons,
      // silently fail and proceed with an empty list of devices.
      const error = String(e) || '';
      if (
        deviceListExecutionExitCode === 127 ||
        error.includes('not a sfdx command')
      ) {
        return Promise.reject(
          new Error(nls.localize('force_lightning_lwc_no_mobile_plugin'))
        );
      }
    }

    return Promise.resolve(items);
  }

  /**
   * Prompts the user to select a device given a device platform. Since generating the list of
   * available devices can be time consuming, an indefinite progress bar will be displayed while
   * waiting for the list to be generated.
   *
   * @param platformSelection The selected platform.
   * @param allowCreatingDevice Indicates whether to present an option to create a new device.
   * @returns The selected device name.
   */
  public static async selectTargetDevice(
    platformSelection: LWCPlatformQuickPickItem,
    allowCreatingDevice: boolean = true
  ): Promise<string> {
    const createNewDeviceItem: DeviceQuickPickItem = {
      label: nls.localize('force_lightning_lwc_create_virtual_device_label'),
      detail: nls.localize('force_lightning_lwc_create_virtual_device_detail'),
      name: nls.localize('force_lightning_lwc_create_virtual_device_label')
    };

    // Show a device pick list with a busy indicator while device-list is being generated
    const selectedItem = await new Promise<DeviceQuickPickItem | undefined>(async (resolve, reject) => {
      let userSelectedItem: DeviceQuickPickItem | undefined;

      // 1. show a pick list with placeholder text and busy progress animation
      const deviceQuickPick = vscode.window.createQuickPick();
      deviceQuickPick.busy = true;
      deviceQuickPick.placeholder = nls.localize('force_lightning_lwc_generating_device_list');
      deviceQuickPick.enabled = false;
      deviceQuickPick.ignoreFocusOut = true;
      deviceQuickPick.show();

      deviceQuickPick.onDidChangeSelection(() => {
        const selectedItems = deviceQuickPick.selectedItems as DeviceQuickPickItem[];
        if (selectedItems && selectedItems.length > 0) {
          userSelectedItem = selectedItems[0];
          deviceQuickPick.dispose();
        }
      });
      deviceQuickPick.onDidHide(() => {
        resolve(userSelectedItem);
      });

      // 2. generate device list
      const items = await LWCUtils.getDeviceList(platformSelection);

      if (allowCreatingDevice) {
        items.unshift(createNewDeviceItem);
      }

      // 3. turn off busy animation and show the device list
      deviceQuickPick.busy = false;
      deviceQuickPick.placeholder = nls.localize('force_lightning_lwc_select_virtual_device');
      deviceQuickPick.enabled = true;
      deviceQuickPick.items = items;
      deviceQuickPick.show();
    });

    if (selectedItem === undefined) {
      // user cancelled the operation
      return Promise.reject(new OperationCancelledException());
    }

    let deviceName = selectedItem.name;

    // if there are no devices available or user chooses to create
    // a new device then show an input box and ask for further info.
    if (deviceName.length === 0 || selectedItem === createNewDeviceItem) {
      const isAndroid = platformSelection.id === DevicePlatformType.Android;
      const createDevicePlaceholderText = isAndroid
        ? nls.localize('force_lightning_lwc_android_target_name')
        : nls.localize('force_lightning_lwc_ios_target_name');
      deviceName = await LWCUtils.getUserInput(undefined, createDevicePlaceholderText);
    }

    return Promise.resolve(deviceName);
  }

  /**
   * Given a path, it recursively goes through that directory and upwards, until it finds
   * a config file named sfdx-project.json and returns the path to the folder containing it.
   *
   * @param startPath Starting path to search for the config file.
   * @returns The path to the folder containing the config file, or undefined if config file not found
   */
  public static getProjectRootDirectory(startPath: string): string | undefined {
    if (!fs.existsSync(startPath)) {
      return undefined;
    }

    const searchingForFile = 'sfdx-project.json';
    let dir: string | undefined = fs.lstatSync(startPath).isDirectory()
      ? startPath
      : path.dirname(startPath);
    while (dir) {
      const fileName = path.join(dir, searchingForFile);
      if (fs.existsSync(fileName)) {
        return dir;
      } else {
        dir = LWCUtils.directoryLevelUp(dir);
      }
    }

    // couldn't determine the root dir
    return undefined;
  }

  /**
   * Given a path to a directory, returns a path that is one level up.
   *
   * @param directory Path to a directory
   * @returns Path to a directory that is one level up, or undefined if cannot go one level up.
   */
  public static directoryLevelUp(directory: string): string | undefined {
    const levelUp = path.dirname(directory);

    if (levelUp === directory) {
      // we're at the root and can't go any further up
      return undefined;
    }

    return levelUp;
  }

  /**
   * Given a platform and a Preview config file, it parses the file and extracts
   * a list of available apps in the config file for the specified platform.
   *
   * @param platformSelection The selected platform
   * @param configFile The Path to a config file
   * @returns A list of available apps in the config file for the specified platform.
   */
  public static getAppOptionsFromPreviewConfigFile(
    platformSelection: LWCPlatformQuickPickItem,
    configFilePath: string | undefined
  ): vscode.QuickPickItem[] {
    const items: vscode.QuickPickItem[] = [];

    if (configFilePath) {
      try {
        const fileContent = fs.readFileSync(configFilePath, 'utf8');
        const json = JSON.parse(fileContent);
        const appDefinitionsForSelectedPlatform =
          platformSelection.id === DevicePlatformType.Android
            ? json.apps.android
            : json.apps.ios;

        const apps = Array.from<any>(appDefinitionsForSelectedPlatform);

        apps.forEach(app => {
          const label: string = app.name;
          const detail: string = app.id;
          items.push({ label, detail });
        });
      } catch {
        // silently fail and return an empty list
      }
    }

    return items;
  }

  /**
   * Executes a given SFDX command.
   *
   * @param command The command to be executed
   * @param deviceName The name of the device to execute the command on.
   * @param logName The name of the logger to be used for this command.
   * @param startTime The start time of the hosting process (used for logging).
   * @param monitorAndroidEmulatorProcess Indicates whether the Android emulator process outputs should be monitored for when the command is done executing.
   */
  public static executeSFDXCommand(
    command: Command,
    logName: string,
    startTime: [number, number],
    monitorAndroidEmulatorProcess: boolean,
    onSuccess: () => void,
    onError: () => void
  ) {
    const cmdExecutor = new CliCommandExecutor(command, {
      env: { SFDX_JSON_TO_STDOUT: 'true' }
    });
    const cmdCancellationTokenSource = new vscode.CancellationTokenSource();
    const cmdCancellationToken = cmdCancellationTokenSource.token;
    const cmdExecution = cmdExecutor.execute(cmdCancellationToken);
    telemetryService.sendCommandEvent(logName, startTime);
    channelService.streamCommandOutput(cmdExecution);
    channelService.showChannelOutput();

    cmdExecution.processExitSubject.subscribe(exitCode => {
      if (exitCode !== 0) {
        onError();
      } else {
        onSuccess();
      }
    });

    // TODO: Remove this when SFDX Plugin launches Android Emulator as separate process.
    // listen for Android Emulator finished
    if (monitorAndroidEmulatorProcess) {
      const androidSuccessString = 'Launching... Opening Browser';

      cmdExecution.stdoutSubject.subscribe(async data => {
        if (data && data.toString().includes(androidSuccessString)) {
          onSuccess();
        }
      });
    }
  }
}
