/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  notificationService,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService } from '../channel';
import { nls } from '../messages';
import { showError } from './commandUtils';
import {
  androidPlatform,
  DevicePlatformType,
  FileBrowseKind,
  iOSPlatform,
  LWCPlatformQuickPickItem,
  LWCUtils,
  OperationCancelledException
} from './lwcUtils';

export interface UTAMTargetApp {
  name: string;
  bundlePath: string;
  appActivity: string;
  appPackage: string;
}

const logName = 'force_lightning_lwc_test_ui_mobile_run';
const commandName = nls.localize('force_lightning_lwc_test_ui_mobile_run_text');
let startTime: [number, number] = [0, 0];

export async function forceLightningLwcTestUIMobileRun(sourceUri: vscode.Uri): Promise<void> {
  startTime = process.hrtime();
  const resourceUri = sourceUri ?? vscode.window.activeTextEditor?.document.uri;
  const resourcePath = sourceUri?.fsPath;

  if (!resourceUri) {
    return LWCUtils.showFailure(logName, commandName, 'force_lightning_lwc_file_undefined', resourceUri);
  }

  if (!resourcePath) {
    return LWCUtils.showFailure(logName, commandName, 'force_lightning_lwc_file_undefined', resourcePath);
  }

  if (!fs.existsSync(resourcePath)) {
    return LWCUtils.showFailure(logName, commandName, 'force_lightning_lwc_file_nonexist', resourcePath);
  }

  return executeCommand(resourcePath);
}

/**
 * Performs the action of running a test using the UI Test Automation Model (UTAM).
 * It takes the path to a test/spec file and then prompts the user to either provide
 * a UTAM WDIO config file or to create a new config file. Running the test is handled
 * the @salesforce/lwc-dev-mobile sfdx package.
 *
 * @param resourcePath The path to the test/spec file
 */
async function executeCommand(resourcePath: string): Promise<void> {
  try {
    const projectRootDir = path.normalize(LWCUtils.getProjectRootDirectory(resourcePath) ?? './');

    // 1. Prompt user to provide a UTAM WDIO config file
    const configFile = await getConfigFile(resourcePath, projectRootDir);

    // 2. Run the test
    await runUTAMTest(configFile, resourcePath);

    notificationService.showSuccessfulExecution(commandName, channelService).catch();
    vscode.window.showInformationMessage(
      nls.localize('force_lightning_lwc_test_ui_mobile_run_success')
    );
  } catch (err) {
    if (err instanceof OperationCancelledException) {
      vscode.window.showWarningMessage(err.message);
    } else {
      showError(err, logName, commandName);
      return Promise.reject(err);
    }
  }
}

/**
 * Prompts the user to either browse for an existing UTAM WDIO config file
 * or to create a new config file. If the user decides to create a new file
 * this method will then takes care of prompting the user for all info needed
 * to create the config file.
 *
 * @returns The path to the config file.
 */
async function getConfigFile(resourcePath: string, projectRootDir: string): Promise<string> {
  const createOption: vscode.QuickPickItem = {
    label: 'Create a new config file'
  };

  const browseOption: vscode.QuickPickItem = {
    label: 'Browse for an existing config file'
  };

  const options = [createOption, browseOption];

  const selectedItem = await LWCUtils.selectItem(options, nls.localize('force_lightning_lwc_test_wdio_config_file'));

  let configFile: string | undefined;
  if (selectedItem === createOption) {
    configFile = await executeConfigureCommand(projectRootDir);
  } else {
    const uri = await vscode.window.showOpenDialog({
      canSelectMany: false,
      defaultUri: vscode.Uri.file(projectRootDir)
    });
    configFile = uri && uri[0] && uri[0].fsPath;
  }

  if (!configFile) {
    // user cancelled the operation
    return Promise.reject(new OperationCancelledException());
  } else {
    return Promise.resolve(configFile);
  }
}

/**
 * Performs the action of creating a WDIO config file. It takes care of prompting the user
 * and gathering all info needed to generate the config file. Generating the config file
 * is handled by the @salesforce/lwc-dev-mobile sfdx package.
 *
 * @param logName The name of the logger to be used when logging.
 * @param commandName The name of the command (used for logging).
 * @param startTime The start time of the root command invoking this method.
 * @param resourcePath The path to the test/spec file
 */
async function executeConfigureCommand(projectRootDir: string): Promise<string> {
  const platformOptions: LWCPlatformQuickPickItem[] = [
    androidPlatform,
    iOSPlatform
  ];

  // 1. Prompt user to select a platform
  const selectedPlatform = await LWCUtils.selectPlatform(platformOptions);

  // 2. Prompt user to select a target device
  const targetDevice = await LWCUtils.selectTargetDevice(selectedPlatform);

  // 3. Prompt user to select a target app
  const targetApp = await selectTargetApp(selectedPlatform);

  // 4. Prompt user to select a test framework
  const testFramework = await selectTestFramework();

  // 5. Prompt user to provide a test runner port number
  const testRunnerPort = await LWCUtils.getUserInput(undefined, nls.localize('force_lightning_lwc_test_runner_port'), undefined, true, true);

  // 6. Prompt user to provide a test runner base url
  const baseUrl = await LWCUtils.getUserInput(undefined, nls.localize('force_lightning_lwc_test_runner_baseUrl'), undefined, true);

  // 7. Prompt user to provide the path to injection config file for UTAM WebdriverIO service (if any)
  let injectionConfigs = '';
  if (targetApp.name === nls.localize('salesforce_mobile_app')) {
    injectionConfigs = 'salesforce-pageobjects/utam-salesforceapp-pageobjects.config.json';
  } else {
    injectionConfigs = await LWCUtils.getFilePath(
      nls.localize('force_lightning_lwc_test_injection_config_file_title'),
      nls.localize('force_lightning_lwc_test_injection_config_file_detail'),
      FileBrowseKind.Open,
      true
    );
  }

  // 8. Prompt user to provide the path for the output config file
  const defaultOutput = path.normalize(path.resolve(projectRootDir, 'wdio.conf.js'));
  let output = await LWCUtils.getFilePath(
    nls.localize('force_lightning_lwc_test_wdio_output_config_file_title'),
    nls.localize('force_lightning_lwc_test_wdio_output_config_file_detail'),
    FileBrowseKind.Save,
    true,
    defaultOutput
  );

  if (!output) {
    output = 'wdio.conf.js';
  }

  const configFilePath = output ?? defaultOutput;

  // 9. Generate WDIO config file
  await generateConfigFile(
    selectedPlatform,
    targetDevice,
    targetApp,
    configFilePath,
    testFramework,
    testRunnerPort,
    baseUrl,
    injectionConfigs
  );

  return Promise.resolve(configFilePath);
}

/**
 * Prompts the user to select a target app for UTAM.
 *
 * @param platformSelection the selected platform.
 * @returns the selected target app.
 */
async function selectTargetApp(
  platformSelection: LWCPlatformQuickPickItem
): Promise<UTAMTargetApp> {
  const labelSApp = nls.localize('salesforce_mobile_app');
  const labelSFSApp = nls.localize('salesforce_field_services_app');
  const labelTestHarnessApp = nls.localize('salesforce_test_harness_app');
  const labelOther = nls.localize('other');

  const items: vscode.QuickPickItem[] = [
    { label: labelSApp },
    // { label: labelSFSApp }, // TODO: add support for SFS App
    // { label: labelTestHarnessApp }, // TODO: add support for Test Harness App
    { label: labelOther }
  ];

  const selectedItem = await LWCUtils.selectItem(items, nls.localize('force_lightning_lwc_select_target_app'));

  const isAndroid = platformSelection.id === DevicePlatformType.Android;

  const appBundlePath = await LWCUtils.getFilePath(
    nls.localize('force_lightning_lwc_app_bundle'),
    isAndroid ? '/path/to/my.apk' : '/path/to/my.app',
    FileBrowseKind.Open
  );

  let activity = '';
  let pkg = '';
  if (isAndroid) {
    if (selectedItem.label === labelSApp) {
      activity = 'com.salesforce.chatter.Chatter';
      pkg = 'com.salesforce.chatter';
    // TODO: add support for SFS and TestHarness Apps
    /*} else if (selectedItem.label === labelSFSApp) {
      activity = 'com.salesforce.fieldservice.ui.launcher.FieldServicePrerequisiteActivity';
      pkg = 'com.salesforce.fieldservice.app';
    } else if (selectedItem.label === labelTestHarnessApp) {
      activity = 'com.salesforce.lsdktestharness.MainActivity';
      pkg = 'com.salesforce.lsdktestharness';*/
    } else {
      activity = await LWCUtils.getUserInput(undefined, nls.localize('force_lightning_lwc_provide_app_activity'));
      pkg = await LWCUtils.getUserInput(undefined, nls.localize('force_lightning_lwc_provide_app_package'));
    }
  }

  const targetApp: UTAMTargetApp = {
    name: selectedItem.label,
    bundlePath: appBundlePath,
    appActivity: activity,
    appPackage: pkg
  };

  return Promise.resolve(targetApp);
}

/**
 * Prompts the user to select a test framework for UTAM.
 *
 * @returns the selected test framework.
 */
async function selectTestFramework(): Promise<string> {
  const items: vscode.QuickPickItem[] = [
    {
      label: 'Jasmine'
    },
    {
      label: 'Mocha'
    },
    {
      label: 'Cucumber'
    }
  ];

  const selectedItem = await LWCUtils.selectItem(items, nls.localize('force_lightning_lwc_select_test_framework'));

  return Promise.resolve(selectedItem.label);
}

/**
 * Generates a config file to be used for running UTAM.
 *
 * @param platformSelection the selected platform (iOS or Android)
 * @param targetDevice the selected device
 * @param targetApp the selected target app
 * @param configFile [Optional] the path to the config file to be created
 * @param testFramework [Optional] the test framework to be used in the config file (jasmine, mocha, cucumber)
 * @param testRunner [Optional] the test runner to be used in the config file (local, browser)
 * @param testRunnerPort [Optional] the test runner port number to be used in the config file
 * @param baseUrl [Optional] the test runner base url to be used in the config file
 * @param injectionConfigs [Optional] the path to injection config file for UTAM WebdriverIO service
 */
async function generateConfigFile(
  platformSelection: LWCPlatformQuickPickItem,
  targetDevice: string,
  targetApp: UTAMTargetApp,
  configFile: string | null = null,
  testFramework: string | null = null,
  testRunnerPort: string | null = null,
  baseUrl: string | null = null,
  injectionConfigs: string | null = null
): Promise<void> {
  return new Promise((resolve, reject) => {
    const isAndroid = platformSelection.id === DevicePlatformType.Android;
    const sfdxMobileConfigCommand = 'force:lightning:lwc:test:ui:mobile:configure';

    let commandBuilder = new SfdxCommandBuilder()
      .withDescription(commandName)
      .withArg(sfdxMobileConfigCommand)
      .withFlag('-p', platformSelection.platformName)
      .withFlag('-d', targetDevice)
      .withFlag('--bundlepath', targetApp.bundlePath);

    if (configFile) {
      commandBuilder = commandBuilder.withFlag('--output', configFile);
    }

    if (testFramework && testFramework.trim().length > 0) {
      commandBuilder = commandBuilder.withFlag('--testframework', testFramework.trim().toLowerCase());
    }

    if (testRunnerPort && testRunnerPort.trim().length > 0) {
      commandBuilder = commandBuilder.withFlag('--port', testRunnerPort.trim());
    }

    if (baseUrl && baseUrl.trim().length > 0) {
      commandBuilder = commandBuilder.withFlag('--baseurl', `'${baseUrl.trim()}'`);
    }

    if (injectionConfigs && injectionConfigs.trim().length > 0) {
      commandBuilder = commandBuilder.withFlag('--injectionconfigs', `${injectionConfigs.trim()}`);
    }

    if (isAndroid && targetApp.appActivity && targetApp.appActivity.trim().length > 0) {
      commandBuilder = commandBuilder.withFlag('--appactivity', targetApp.appActivity.trim());
    }

    if (isAndroid && targetApp.appPackage && targetApp.appPackage.trim().length > 0) {
      commandBuilder = commandBuilder.withFlag('--apppackage', targetApp.appPackage.trim());
    }

    const configureCommand = commandBuilder.build();

    const onError = () => {
      reject(new Error(nls.localize('force_lightning_lwc_test_ui_mobile_run_failure')));
    };

    const onSuccess = () => {
      resolve();
    };

    LWCUtils.executeSFDXCommand(configureCommand, logName, startTime, false, onSuccess, onError);
  });
}

/**
 * Runs a UTAM test using force:lightning:lwc:test:ui:mobile:run sfdx command.
 *
 * @param wdioConfigFile The path to a UTAM WDIO config file.
 * @param resourcePath The path to the test/spec file
 */
async function runUTAMTest(
  wdioConfigFile: string,
  resourcePath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
      const sfdxMobileUTAMRunCommand = 'force:lightning:lwc:test:ui:mobile:run';

      const runCommand = new SfdxCommandBuilder()
        .withDescription(commandName)
        .withArg(sfdxMobileUTAMRunCommand)
        .withFlag('-f', wdioConfigFile)
        .withFlag('--spec', resourcePath)
        .build();

      const onError = () => {
        reject(new Error(nls.localize('force_lightning_lwc_test_ui_mobile_run_failure')));
      };

      const onSuccess = () => {
        resolve();
      };

      LWCUtils.executeSFDXCommand(runCommand, logName, startTime, false, onSuccess, onError);
  });
}
