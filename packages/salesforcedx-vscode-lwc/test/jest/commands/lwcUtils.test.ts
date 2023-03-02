/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  CancellationToken,
  CliCommandExecution,
  CliCommandExecutor,
  CommandBuilder,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode';

import * as fs from 'fs';
import * as path from 'path';
import { Subject } from 'rxjs/Subject';
import {
  InputBox,
  OpenDialogOptions,
  QuickPick,
  QuickPickItem,
  QuickPickOptions,
  SaveDialogOptions,
  Uri,
  window
} from 'vscode';
import * as commandUtils from '../../../src/commands/commandUtils';
import {
  DeviceQuickPickItem,
  FileBrowseKind,
  LWCPlatformQuickPickItem,
  OperationCancelledException,
  LWCUtils,
  androidPlatform,
  iOSPlatform,
  InputBoxButton
} from '../../../src/commands/lwcUtils';
import { nls } from '../../../src/messages';

jest.mock('../../../src/channel');

describe('lwcUtils', () => {
  const sfdxDeviceListCommand = 'force:lightning:local:device:list';

  let fakeExecutor: jest.SpyInstance<CliCommandExecution, any>;
  let fakeExecution: any;
  let fakeBuilder: any;
  let withArgFake: jest.SpyInstance<CommandBuilder, [arg: string]>;
  let withFlagFake: jest.SpyInstance<CommandBuilder, [name: string, value: string]>;

  beforeEach(() => {
    fakeBuilder = {
      execute: jest.fn().mockReturnValue({ fake: 'execution' }),
      withArg: jest.fn(),
      withFlag: jest.fn(),
      withJson: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({ fake: true })
    };
    fakeBuilder.withArg.mockReturnValue(fakeBuilder);
    fakeBuilder.withFlag.mockReturnValue(fakeBuilder);

    withFlagFake = fakeBuilder.withFlag;

    jest.spyOn(SfdxCommandBuilder.prototype, 'withDescription').mockReturnValue(fakeBuilder);
    withArgFake = jest.spyOn(SfdxCommandBuilder.prototype, 'withArg').mockReturnValue(fakeBuilder);
    jest.spyOn(SfdxCommandBuilder.prototype, 'withFlag').mockReturnValue(fakeBuilder);
    jest.spyOn(SfdxCommandBuilder.prototype, 'withJson').mockReturnValue(fakeBuilder);

    fakeExecution = {
      stdoutSubject: new Subject<string>(),
      stderrSubject: new Subject<string>(),
      processExitSubject: new Subject<number>(),
    };

    fakeExecutor = jest.spyOn(CliCommandExecutor.prototype, 'execute').mockReturnValue(fakeExecution);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('showFailure', () => {
    it('throws an error and displays the error to the user', async () => {
      const expectedMessage = nls.localize('force_lightning_lwc_ios_failure', 'abcd');
      const showErrorFake = jest.spyOn(commandUtils, 'showError').mockImplementation(() => {});
  
      let err: Error | null = null;
      try {
        await LWCUtils.showFailure('logName', 'commandName', 'force_lightning_lwc_ios_failure', 'abcd');
      } catch (e) {
        err = e;
      }
  
      // verify that LWCUtils.showFailure() calls commandUtils.showError() with correct args
      expect(showErrorFake).toHaveBeenCalledWith(new Error(expectedMessage), 'logName', 'commandName');
  
      // verify that LWCUtils.showFailure() returns a rejected promise with correct error
      expect(err?.message).toBe(expectedMessage);
    });
  });

  describe('selectItem', () => {
    it('selectItem - Operation Cancelled', async () => {
      await doSelectItemTest(true);
    });
  
    it('selectItem - Operation Succeeded', async () => {
      await doSelectItemTest(false);
    });
  
    async function doSelectItemTest(isCancelling: boolean) {
      const placeholder = 'placeholder text';
      const items: QuickPickItem[] = [ { label: 'A' }, { label: 'B' }, { label: 'C' } ];
      const expectedUserInput = isCancelling ? undefined : items[0];
  
      // mock window.showQuickPick
      window.showQuickPick = 
        <T extends QuickPickItem>(
          items: readonly T[] | Thenable<readonly T[]>,
          options?: QuickPickOptions,
          token?: CancellationToken
        ): Thenable<T | undefined> => {
        return Promise.resolve(<T>expectedUserInput);
      }
  
      let selectedItem: QuickPickItem | undefined = undefined
      let err: Error | null = null;
      try {
        selectedItem = await LWCUtils.selectItem(items, placeholder);
      } catch (e) {
        err = e;
      }
  
      // verify that the selected item is as expected
      expect(selectedItem).toBe(expectedUserInput);
  
      // if simulating operation cancelled then an error should have been thrown
      if (isCancelling) {
        expect(err?.message).toBe((new OperationCancelledException()).message);
      } else {
        expect(err).toBeNull();
      }
    }
  });

  describe('getUserInput', () => {
    it('validateString', () => {
      const msg = nls.localize('user_input_invalid');
  
      // accept empty string
      let errMsg = LWCUtils.validateString(undefined, true, false);
      expect(errMsg).toBe(undefined);
  
      // don't accept empty string
      errMsg = LWCUtils.validateString(undefined, false, false);
      expect(errMsg).toBe(msg);
  
      // accept any character
      errMsg = LWCUtils.validateString('test input', false, false);
      expect(errMsg).toBe(undefined);
  
      // accept numeric only
      errMsg = LWCUtils.validateString('test input', false, true);
      expect(errMsg).toBe(msg);
  
      // accept numeric only
      errMsg = LWCUtils.validateString('1234', false, true);
      expect(errMsg).toBe(undefined);
    });
  
    it('getUserInput - Operation Cancelled', async () => {
      await doGetUserInputTest(true);
    });
  
    it('getUserInput - Operation Succeeded', async () => {
      await doGetUserInputTest(false);
    });
  
    async function doGetUserInputTest(isCancelling: boolean) {
      const expectedUserInput = isCancelling ? null : 'test input';
  
      // mock window.createInputBox
      window.createInputBox = (): InputBox => createMockInputBox(expectedUserInput ?? '', isCancelling, false);
      
      let input: string | null = null;
      let err: Error | null = null;
      try {
        input = await LWCUtils.getUserInput('title', 'placeholder text', undefined, false);
      } catch (e) {
        err = e;
      }
  
      // verify that the input is as expected
      expect(input).toBe(expectedUserInput);
  
      // if simulating operation cancelled then an error should have been thrown
      if (isCancelling) {
        expect(err?.message).toBe((new OperationCancelledException()).message);
      } else {
        expect(err).toBeNull();
      }
    }
  });

  describe('getFilePath', () => {
    it('getFilePath - Operation Cancelled', async () => {
      await doGetFilePathTest(true, FileBrowseKind.Open);
    });
  
    it('getFilePath - Open File', async () => {
      await doGetFilePathTest(false, FileBrowseKind.Open);
    });
  
    it('getFilePath - Save File', async () => {
      await doGetFilePathTest(false, FileBrowseKind.Save);
    });
  
    async function doGetFilePathTest(isCancelling: boolean, browseKind: FileBrowseKind) {
      const expectedPath = '/path/to/wdio.conf.js';
  
      jest.spyOn(LWCUtils, 'getThemeIcon').mockReturnValue(Uri.file('myIcon.svg'));
  
      // mock window.showOpenDialog
      const showOpenDialogFake = jest.fn((options?: OpenDialogOptions): Thenable<Uri[] | undefined> =>Promise.resolve([Uri.file(expectedPath)]));
      window.showOpenDialog = showOpenDialogFake;
  
      // mock window.showSaveDialog
      const showSaveDialogFake = jest.fn((options?: SaveDialogOptions): Thenable<Uri | undefined> =>Promise.resolve(Uri.file(expectedPath)));
      window.showSaveDialog = showSaveDialogFake;
  
      // mock window.createInputBox
      window.createInputBox = (): InputBox => createMockInputBox(expectedPath ?? '', isCancelling, true);
  
      let input: string | null = null;
      let err: Error | null = null;
      try {
        input = await LWCUtils.getFilePath('title', 'placeholder', browseKind, false);
      } catch (e) {
        err = e;
      }
  
      if (isCancelling) {
        expect(input).toBeNull();
        expect(err?.message).toBe((new OperationCancelledException()).message);
        expect(showOpenDialogFake).not.toHaveBeenCalled();
        expect(showSaveDialogFake).not.toHaveBeenCalled();
      } else {
        expect(input).toBe(expectedPath);
        expect(err).toBeNull();
        expect(showOpenDialogFake).toHaveBeenCalledTimes(browseKind === FileBrowseKind.Open ? 1 : 0);
        expect(showSaveDialogFake).toHaveBeenCalledTimes(browseKind === FileBrowseKind.Save ? 1 : 0);
      }
    }
  });

  describe('getDeviceList', () => {
    it('getDeviceList - command not found', async () => {
      jest.spyOn(CommandOutput.prototype, 'getCmdResult').mockReturnValue(Promise.reject(`${sfdxDeviceListCommand} is not a sfdx command`));
  
      let err: Error | null = null;
      try {
        await LWCUtils.getDeviceList(androidPlatform);
      } catch (e) {
        err = e;
      }
  
      expect(err?.message).toBe(nls.localize('force_lightning_lwc_no_mobile_plugin'));
    });
  
    it('getDeviceList - iOS', async () => {
      await doGetDeviceListTest(false);
    });
  
    it('getDeviceList - Android', async () => {
      await doGetDeviceListTest(true);
    });
  
    async function doGetDeviceListTest(isAndroid: boolean) {
      const platform: LWCPlatformQuickPickItem = isAndroid  ? androidPlatform : iOSPlatform;
  
      const deviceListJsonResponse = isAndroid 
      ? `
        {
          "status":0,
          "result":[
            {
                "name":"emu2",
                "displayName":"emu2",
                "deviceName":"pixel",
                "path":"/Users/testuser/.android/avd/emu2.avd",
                "target":"Default Android System Image",
                "api":"API 33"
            },
            {
                "name":"Pixel_API_29",
                "displayName":"Pixel API 29",
                "deviceName":"pixel",
                "path":"/Users/testuser/.android/avd/Pixel_API_29.avd",
                "target":"Google APIs",
                "api":"API 29"
            }
          ]
        }
      `
      : `
      {
        "status":0,
        "result":[
          {
              "name":"iPhone 8",
              "udid":"6CC16032-2671-4BD2-8FF1-0E314945010C",
              "state":"Shutdown",
              "runtimeId":"iOS 13.3",
              "isAvailable":true
          },
          {
              "name":"LWCSimulator",
              "udid":"09D522C8-DC85-4259-AD15-15D36672D2EA",
              "state":"Shutdown",
              "runtimeId":"iOS 14.2",
              "isAvailable":true
          }
        ]
      }
      `;
  
      jest.spyOn(CommandOutput.prototype, 'getCmdResult').mockResolvedValue(deviceListJsonResponse);
  
      const results = await LWCUtils.getDeviceList(platform);
  
      expect(results.length).toBe(2);
  
      if (isAndroid) {
        expect(results[0].label).toBe('emu2');
        expect(results[0].detail).toBe('Default Android System Image, API 33');
        expect(results[0].name).toBe('emu2');
  
        expect(results[1].label).toBe('Pixel API 29');
        expect(results[1].detail).toBe('Google APIs, API 29');
        expect(results[1].name).toBe('Pixel_API_29');
      } else {
        expect(results[0].label).toBe('iPhone 8');
        expect(results[0].detail).toBe('iOS 13.3');
        expect(results[0].name).toBe('6CC16032-2671-4BD2-8FF1-0E314945010C');
  
        expect(results[1].label).toBe('LWCSimulator');
        expect(results[1].detail).toBe('iOS 14.2');
        expect(results[1].name).toBe('09D522C8-DC85-4259-AD15-15D36672D2EA');
      }
  
      expect(fakeBuilder.build).toHaveBeenCalled();
  
      expect(withArgFake).toHaveBeenCalledTimes(1);
      expect(withArgFake).toHaveBeenCalledWith(sfdxDeviceListCommand);
  
      expect(withFlagFake).toHaveBeenCalledTimes(1);
      expect(withFlagFake).toHaveBeenCalledWith('-p', platform.platformName);
    }
  });

  describe('selectTargetDevice', () => {
    it('selectTargetDevice - Operation Cancelled', async () => {
      await doSelectTargetDeviceTest(0, true, false);
    });
  
    it('selectTargetDevice - select device', async () => {
      await doSelectTargetDeviceTest(1, false, false);
    });
  
    it('selectTargetDevice - create device', async () => {
      await doSelectTargetDeviceTest(0, false, true);
    });
  
    async function doSelectTargetDeviceTest(selectedIndex: number, isCancelling: boolean, isCreating: boolean) {
      const devices: DeviceQuickPickItem[] = [
        {
          name: '6CC16032-2671-4BD2-8FF1-0E314945010C',
          label: 'iPhone 8',
          detail: 'iOS 13.3'
        },
        {
          name: '09D522C8-DC85-4259-AD15-15D36672D2EA',
          label: 'LWCSimulator',
          detail: 'iOS 14.2'
        },
      ]
  
      const expectedDeviceName: string | null = isCancelling ? null : isCreating ? 'TestDeviceName' : devices[selectedIndex - 1].name;
      let selectedDeviceName: string | null = null;
      let err: Error | null = null;
  
      jest.spyOn(LWCUtils, 'getDeviceList').mockResolvedValue(devices);
      jest.spyOn(LWCUtils, 'getUserInput').mockResolvedValue(expectedDeviceName ?? '');
  
      // mock window.createQuickPick
      window.createQuickPick = (): QuickPick<any> => createMockQuickPick(selectedIndex, isCancelling);
  
      try {
        selectedDeviceName = await LWCUtils.selectTargetDevice(iOSPlatform);
      } catch (e) {
        err = e;
      }
  
      // verify that the selected item is as expected
      expect(selectedDeviceName).toBe(expectedDeviceName);
  
      // if simulating operation cancelled then an error should have been thrown
      if (isCancelling) {
        expect(err?.message).toBe((new OperationCancelledException()).message);
      } else {
        expect(err).toBeNull();
      }
    }
  });

  describe('executeSFDXCommand', () => {
    it('executeSFDXCommand - iOS Success', () => {
      doExecuteSFDXCommandTest(false, false);
    });
  
    it('executeSFDXCommand - Android Success', () => {
      doExecuteSFDXCommandTest(true, false);
    });
  
    it('executeSFDXCommand - iOS Failure', () => {
      doExecuteSFDXCommandTest(false, true);
    });
  
    it('executeSFDXCommand - Android Failure', () => {
      doExecuteSFDXCommandTest(true, true);
    });
  
    function doExecuteSFDXCommandTest(isAndroid: boolean, isErrorCase: boolean) {
      const platform: LWCPlatformQuickPickItem = isAndroid ? androidPlatform : iOSPlatform;
  
      let cmd = new SfdxCommandBuilder()
        .withArg('mycommand')
        .withFlag('-p', platform.platformName)
        .build();
  
      let onErrorCalled = false;
      let onSuccessCalled = false;
      const onError = () => { onErrorCalled = true; };
      const onSuccess = () => { onSuccessCalled = true; };
  
      LWCUtils.executeSFDXCommand(cmd, 'logName', process.hrtime(), isAndroid, onSuccess, onError);
      if (isAndroid && !isErrorCase) {
        const androidSuccessString = 'Launching... Opening Browser';
        fakeExecution.stdoutSubject.next(androidSuccessString);
      } else {
        const exitCode = isErrorCase ? -1 : 0;
        fakeExecution.processExitSubject.next(exitCode);
      }
  
      expect(onErrorCalled).toBe(isErrorCase ? true : false);
      expect(onSuccessCalled).toBe(isErrorCase ? false : true);
    }    
  });

  it('Project Root Directory', async () => {
    jest.spyOn(fs, 'lstatSync').mockReturnValue({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    // returns undefined for invalid path
    expect(
      LWCUtils.getProjectRootDirectory(path.normalize('/invalidpath')) === undefined
    ).toBe(true);

    // returns undefined when path is valid but sfdx-project.json not found
    jest.spyOn(fs, 'existsSync').mockImplementation(
      fsPath => path.normalize(fsPath as string) === path.normalize('/my/path')
    );
    expect(
      LWCUtils.getProjectRootDirectory(path.normalize('/my/path')) === undefined
    ).toBe(true);

    // returns correct path when path is valid and sfdx-project.json is found
    jest.spyOn(fs, 'existsSync').mockImplementation(
      fsPath =>
        path.normalize(fsPath as string) === path.normalize('/my/path') ||
        path.normalize(fsPath as string) === path.normalize('/my/sfdx-project.json')
    );
    expect(
      LWCUtils.getProjectRootDirectory(path.normalize('/my/path')) === path.normalize('/my')
    ).toBe(true);
  });

  it('Directory Level Up', async () => {
    expect(
      LWCUtils.directoryLevelUp(path.normalize('/my/path')) === path.normalize('/my')
    ).toBe(true);
    expect(
      LWCUtils.directoryLevelUp(path.normalize('/my')) === path.normalize('/')
    ).toBe(true);
    expect(
      LWCUtils.directoryLevelUp(path.normalize('/')) === undefined
    ).toBe(true);
  });

  it('getAppOptionsFromPreviewConfigFile', async () => {
    const appConfigFileJson = `
      {
        "apps": {
          "ios": [
            {
              "id": "com.salesforce.mobile-tooling.lwc-test-app",
              "name": "LWC Test App - iOS",
              "get_app_bundle": "configure_test_app.js",
              "launch_arguments": [
                { "name": "arg1", "value": "val1" },
                { "name": "arg2", "value": "val2" }
              ]
            }
          ],
          "android": [
            {
              "id": "com.salesforce.mobile-tooling.lwc-test-app",
              "name": "LWC Test App - Android",
              "activity": ".MainActivity",
              "get_app_bundle": "configure_test_app.js",
              "launch_arguments": [
                { "name": "arg1", "value": "val1" },
                { "name": "arg2", "value": "val2" }
              ]
            }
          ]
        }
      }
    `;

    jest.spyOn(fs, 'readFileSync').mockReturnValue(appConfigFileJson);

    const iosApps = LWCUtils.getAppOptionsFromPreviewConfigFile(iOSPlatform, 'mobile-apps.json');
    const androidApps = LWCUtils.getAppOptionsFromPreviewConfigFile(androidPlatform, 'mobile-apps.json');

    expect(iosApps.length).toBe(1);
    expect(iosApps[0].label).toBe('LWC Test App - iOS');
    expect(iosApps[0].detail).toBe('com.salesforce.mobile-tooling.lwc-test-app');

    expect(androidApps.length).toBe(1);
    expect(androidApps[0].label).toBe('LWC Test App - Android');
    expect(androidApps[0].detail).toBe('com.salesforce.mobile-tooling.lwc-test-app');
  });

  function createMockInputBox(mockValue: string, cancelOnShow: boolean, simulateButton: boolean): any { 
    let onDidTriggerButtonFn = (button: InputBoxButton): void => {}
    let onDidAcceptFn = (): void => {}
    let onDidHideFn = (): void => {}
    
    return {    
      value: mockValue,

      buttons: [],

      onDidTriggerButton: (fn: (button: InputBoxButton) => void): void => { 
        onDidTriggerButtonFn = fn;
      },

      onDidAccept: (fn: () => void): void => { 
        onDidAcceptFn = fn;
      },

      onDidHide: (fn: () => void): void => { 
        onDidHideFn = fn;
      },
    
      show(): void {
        if (cancelOnShow) {
          this.hide();
        } else {
          if (simulateButton && this.buttons.length > 0) {
            onDidTriggerButtonFn(this.buttons[0]);
          }
          onDidAcceptFn();
        }
      },

      hide(): void {
        onDidHideFn();
      },

      dispose(): void {
        this.hide();
      }
    }
  }

  function createMockQuickPick(selectedItemIndex: number, cancelOnShow: boolean): any {
    let onDidChangeSelectionFn = (items: QuickPickItem[]): void => {}
    let onDidHideFn = (): void => {}

    return {
      enabled: true,
  
      onDidChangeSelection: (fn: (items: QuickPickItem[]) => void): void => { 
        onDidChangeSelectionFn = fn;
      },

      onDidHide: (fn: () => void): void => { 
        onDidHideFn = fn;
      },

      show(): void {
        if (this.enabled && this.items.length > 0) {
          if (cancelOnShow) {
            this.hide();
          } else {
            this.selectedItems = [this.items[selectedItemIndex]];
            onDidChangeSelectionFn(this.selectedItems);
          }
        }
      },

      hide(): void {
        onDidHideFn();
      },

      dispose(): void {
        this.hide();
      }
    };
  }
});
