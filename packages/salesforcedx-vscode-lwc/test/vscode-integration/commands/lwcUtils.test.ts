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
  Command,
  CommandExecution,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import { Subject } from 'rxjs/Subject';
import { SinonSandbox } from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as commandUtils from '../../../src/commands/commandUtils';
import { nls } from '../../../src/messages';
import {
  DevicePlatformName,
  DevicePlatformType,
  DeviceQuickPickItem,
  FileBrowseKind,
  LWCPlatformQuickPickItem,
  OperationCancelledException,
  LWCUtils
} from '../../../src/commands/lwcUtils';
import { Emitter } from 'vscode-languageclient';

describe('lwcUtils', () => {
  let sandbox: SinonSandbox;

  class MockExecution implements CommandExecution {
    public command: Command;
    public processExitSubject: Subject<number>;
    public processErrorSubject: Subject<Error>;
    public stdoutSubject: Subject<string>;
    public stderrSubject: Subject<string>;

    constructor(command: Command) {
      this.command = command;
      this.processExitSubject = new Subject<number>();
      this.processErrorSubject = new Subject<Error>();
      this.stdoutSubject = new Subject<string>();
      this.stderrSubject = new Subject<string>();
    }

    public killExecution(): Promise<void> {
      return Promise.resolve();
    }
  }

  class MockInputBox implements vscode.InputBox {
    cancelOnShow: boolean = false;
    simulateButton: boolean = false

    value: string = '';
    valueSelection: readonly [number, number] | undefined;
    placeholder: string | undefined;
    password: boolean = false;
    buttons: readonly vscode.QuickInputButton[] = [];
    prompt: string | undefined;
    validationMessage: string | vscode.InputBoxValidationMessage | undefined;
    title: string | undefined;
    step: number | undefined;
    totalSteps: number | undefined;
    enabled: boolean = true;
    busy: boolean = false;
    ignoreFocusOut: boolean = false;

    onDidChangeValueEmitter = new Emitter<string>();
    onDidAcceptEmitter = new Emitter<void>();
    onDidTriggerButtonEmitter = new Emitter<vscode.QuickInputButton>();
    onDidHideEmitter = new Emitter<void>();

    onDidChangeValue: vscode.Event<string> = this.onDidChangeValueEmitter.event;
    onDidAccept: vscode.Event<void> = this.onDidAcceptEmitter.event;
    onDidTriggerButton: vscode.Event<vscode.QuickInputButton> = this.onDidTriggerButtonEmitter.event;
    onDidHide: vscode.Event<void> = this.onDidHideEmitter.event;

    show(): void {
      if (this.cancelOnShow) {
        this.hide();
      } else {
        if (this.simulateButton && this.buttons.length > 0) {
          this.onDidTriggerButtonEmitter.fire(this.buttons[0]);
        }
        this.onDidAcceptEmitter.fire();
      }
    }
    hide(): void {
      this.onDidHideEmitter.fire();
    }
    dispose(): void {
      this.hide();
    }

    constructor(mockValue: string, cancelOnShow: boolean, simulateButton: boolean) {
      this.value = mockValue;
      this.cancelOnShow = cancelOnShow;
      this.simulateButton = simulateButton;
    }
  }

  class MockQuickPick implements vscode.QuickPick<vscode.QuickPickItem> {
    cancelOnShow: boolean = false;
    selectedItemIndex: number;

    value: string = '';
    placeholder: string | undefined;
    password: boolean = false;
    buttons: readonly vscode.QuickInputButton[] = [];
    title: string | undefined;
    step: number | undefined;
    totalSteps: number | undefined;
    enabled: boolean = true;
    busy: boolean = false;
    ignoreFocusOut: boolean = false;
    items: readonly vscode.QuickPickItem[] = [];
    canSelectMany: boolean = false;
    matchOnDescription: boolean = false;
    matchOnDetail: boolean = false;
    keepScrollPosition?: boolean | undefined;
    activeItems: readonly vscode.QuickPickItem[] = [];
    selectedItems: readonly vscode.QuickPickItem[] = [];

    onDidChangeValueEmitter = new Emitter<string>();
    onDidAcceptEmitter = new Emitter<void>();
    onDidTriggerButtonEmitter = new Emitter<vscode.QuickInputButton>();
    onDidTriggerItemButtonEmitter = new Emitter<vscode.QuickPickItemButtonEvent<vscode.QuickPickItem>>();
    onDidChangeActiveEmitter = new Emitter<readonly vscode.QuickPickItem[]>();
    onDidChangeSelectionEmitter = new Emitter<readonly vscode.QuickPickItem[]>();
    onDidHideEmitter = new Emitter<void>();

    onDidChangeValue: vscode.Event<string> = this.onDidChangeValueEmitter.event;
    onDidAccept: vscode.Event<void> = this.onDidAcceptEmitter.event;
    onDidTriggerButton: vscode.Event<vscode.QuickInputButton> = this.onDidTriggerButtonEmitter.event;
    onDidTriggerItemButton: vscode.Event<vscode.QuickPickItemButtonEvent<vscode.QuickPickItem>> = this.onDidTriggerItemButtonEmitter.event;
    onDidChangeActive: vscode.Event<readonly vscode.QuickPickItem[]> = this.onDidChangeActiveEmitter.event;
    onDidChangeSelection: vscode.Event<readonly vscode.QuickPickItem[]> = this.onDidChangeSelectionEmitter.event;
    onDidHide: vscode.Event<void> = this.onDidHideEmitter.event;

    show(): void {
      if (this.enabled && this.items.length > 0) {
        if (this.cancelOnShow) {
          this.hide();
        } else {
          this.selectedItems = [this.items[this.selectedItemIndex]];
          this.onDidChangeSelectionEmitter.fire(this.selectedItems);
        }
      }
    }
    hide(): void {
      this.onDidHideEmitter.fire();
    }
    dispose(): void {
      this.hide();
    }
    
    constructor(selectedItemIndex: number, cancelOnShow: boolean) {
      this.selectedItemIndex = selectedItemIndex;
      this.cancelOnShow = cancelOnShow;
    }
  }

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sinon.restore();
    sandbox.restore();
  });

  it('showFailure Test', async () => {
    const expectedMessage = nls.localize('force_lightning_lwc_ios_failure', 'abcd');
    const showErrorSpy = sandbox.spy(commandUtils, 'showError');

    let err: Error | null = null;
    try {
      await LWCUtils.showFailure('logName', 'commandName', 'force_lightning_lwc_ios_failure', 'abcd');
    } catch (e) {
      err = e;
    }

    expect(err?.message).to.be.equal(expectedMessage);

    expect(showErrorSpy.callCount).to.equal(1);
    expect(showErrorSpy.getCall(0).args[0].message).equals(expectedMessage);
    expect(showErrorSpy.getCall(0).args[1]).equals('logName');
    expect(showErrorSpy.getCall(0).args[2]).equals('commandName');
  });

  it('selectItem - Operation Cancelled', async () => {
    await doSelectItemTest(true);
  });

  it('selectItem - Operation Succeeded', async () => {
    await doSelectItemTest(false);
  });

  async function doSelectItemTest(isCancelling: boolean) {
    const placeholder = 'placeholder text';
    const items: vscode.QuickPickItem[] = [ { label: 'A' }, { label: 'B' }, { label: 'C' } ];
    const expectedUserInput = isCancelling ? undefined : items[0];

    const showQuickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
    showQuickPickStub.withArgs(items, sinon.match.any).resolves(expectedUserInput);

    let selectedItem: vscode.QuickPickItem | undefined = undefined
    let err: Error | null = null;
    try {
      selectedItem = await LWCUtils.selectItem(items, placeholder);
    } catch (e) {
      err = e;
    }

    expect(selectedItem).equals(expectedUserInput);
    if (isCancelling) {
      expect(err?.message).to.equal((new OperationCancelledException()).message);
    } else {
      expect(err).to.be.equal(null);
    }
    
  }

  it('validateString', () => {
    const msg = nls.localize('user_input_invalid');

    // accept empty string
    let errMsg = LWCUtils.validateString(undefined, true, false);
    expect(errMsg).to.equal(undefined);

    // don't accept empty string
    errMsg = LWCUtils.validateString(undefined, false, false);
    expect(errMsg).to.equal(msg);

    // accept any character
    errMsg = LWCUtils.validateString('test input', false, false);
    expect(errMsg).to.equal(undefined);

    // accept numeric only
    errMsg = LWCUtils.validateString('test input', false, true);
    expect(errMsg).to.equal(msg);

    // accept numeric only
    errMsg = LWCUtils.validateString('1234', false, true);
    expect(errMsg).to.equal(undefined);
  });

  it('getUserInput - Operation Cancelled', async () => {
    await doGetUserInputTest(true);
  });

  it('getUserInput - Operation Succeeded', async () => {
    await doGetUserInputTest(false);
  });

  async function doGetUserInputTest(isCancelling: boolean) {
    const expectedUserInput = isCancelling ? null : 'test input';
    const mockInputBox = new MockInputBox(expectedUserInput ?? '', isCancelling, false);

    const createInputBoxStub = sandbox.stub(vscode.window, 'createInputBox');
    createInputBoxStub.returns(mockInputBox);
    
    let input: string | null = null;
    let err: Error | null = null;
    try {
      input = await LWCUtils.getUserInput('title', 'placeholder text', undefined, false);
    } catch (e) {
      err = e;
    }

    expect(input).to.be.equal(expectedUserInput);
    if (isCancelling) {
      expect(err?.message).to.equal((new OperationCancelledException()).message);
    } else {
      expect(err).to.be.equal(null);
    }
  }

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

    const showOpenDialogStub = sandbox.stub(vscode.window, 'showOpenDialog');
    showOpenDialogStub.resolves([vscode.Uri.file(expectedPath)]);

    const showSaveDialogStub = sandbox.stub(vscode.window, 'showSaveDialog');
    showSaveDialogStub.resolves(vscode.Uri.file(expectedPath));

    const mockInputBox = new MockInputBox(expectedPath ?? '', isCancelling, true);
    const createInputBoxStub = sandbox.stub(vscode.window, 'createInputBox');
    createInputBoxStub.returns(mockInputBox);
    
    let input: string | null = null;
    let err: Error | null = null;
    try {
      input = await LWCUtils.getFilePath('title', 'placeholder', browseKind, false)
    } catch (e) {
      err = e;
    }

    if (isCancelling) {
      expect(input).to.be.equal(null);
      expect(err?.message).to.equal((new OperationCancelledException()).message);
      expect(showOpenDialogStub.callCount).to.equal(0);
      expect(showSaveDialogStub.callCount).to.equal(0);
    } else {
      expect(input).to.be.equal(expectedPath);
      expect(err).to.be.equal(null);
      expect(showOpenDialogStub.callCount).to.equal(browseKind === FileBrowseKind.Open ? 1 : 0);
      expect(showSaveDialogStub.callCount).to.equal(browseKind === FileBrowseKind.Save ? 1 : 0);
    }
  }

  it('getDeviceList - iOS', async () => {
    await doGetDeviceListTest(false);
  });

  it('getDeviceList - Android', async () => {
    await doGetDeviceListTest(true);
  });

  async function doGetDeviceListTest(isAndroid: boolean) {
    const sfdxDeviceListCommand = 'force:lightning:local:device:list'

    const platform: LWCPlatformQuickPickItem = isAndroid 
    ? {
      label: nls.localize('force_lightning_lwc_android_label'),
      detail: nls.localize('force_lightning_lwc_android_description'),
      alwaysShow: true,
      picked: false,
      id: DevicePlatformType.Android,
      platformName: DevicePlatformName.Android,
      defaultTargetName: 'SFDXEmulator'
    }
    : {
      label: nls.localize('force_lightning_lwc_ios_label'),
      detail: nls.localize('force_lightning_lwc_ios_description'),
      alwaysShow: true,
      picked: false,
      id: DevicePlatformType.iOS,
      platformName: DevicePlatformName.iOS,
      defaultTargetName: 'SFDXSimulator'
    };

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

    const cmdWithArgSpy = sandbox.spy(SfdxCommandBuilder.prototype, 'withArg');
    const cmdWithFlagSpy = sandbox.spy(SfdxCommandBuilder.prototype, 'withFlag');
    const mockExecution = new MockExecution(new SfdxCommandBuilder().build());
    const mobileExecutorStub: sinon.SinonStub<[(CancellationToken | undefined)?], CliCommandExecution | MockExecution> = sinon.stub(CliCommandExecutor.prototype, 'execute');
    mobileExecutorStub.returns(mockExecution);
    const commandOutputStub = sinon.stub(CommandOutput.prototype, 'getCmdResult');
    commandOutputStub.resolves(deviceListJsonResponse);

    const results = await LWCUtils.getDeviceList(platform);

    expect(results.length).to.equal(2);

    if (isAndroid) {
      expect(results[0].label).to.equal('emu2');
      expect(results[0].detail).to.equal('Default Android System Image, API 33');
      expect(results[0].name).to.equal('emu2');

      expect(results[1].label).to.equal('Pixel API 29');
      expect(results[1].detail).to.equal('Google APIs, API 29');
      expect(results[1].name).to.equal('Pixel_API_29');
    } else {
      expect(results[0].label).to.equal('iPhone 8');
      expect(results[0].detail).to.equal('iOS 13.3');
      expect(results[0].name).to.equal('6CC16032-2671-4BD2-8FF1-0E314945010C');

      expect(results[1].label).to.equal('LWCSimulator');
      expect(results[1].detail).to.equal('iOS 14.2');
      expect(results[1].name).to.equal('09D522C8-DC85-4259-AD15-15D36672D2EA');
    }

    expect(cmdWithArgSpy.callCount).to.equal(1);
    expect(cmdWithArgSpy.getCall(0).args[0]).equals(sfdxDeviceListCommand);
    expect(cmdWithFlagSpy.callCount).to.equal(1);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
      '-p',
      platform.platformName
    ]);
    sinon.assert.calledOnce(mobileExecutorStub);
  }

  it('getDeviceList - command not found', async () => {
    const sfdxDeviceListCommand = 'force:lightning:local:device:list'

    const platform: LWCPlatformQuickPickItem =  {
      label: nls.localize('force_lightning_lwc_android_label'),
      detail: nls.localize('force_lightning_lwc_android_description'),
      alwaysShow: true,
      picked: false,
      id: DevicePlatformType.Android,
      platformName: DevicePlatformName.Android,
      defaultTargetName: 'SFDXEmulator'
    };

    const mockExecution = new MockExecution(new SfdxCommandBuilder().build());
    const mobileExecutorStub: sinon.SinonStub<[(CancellationToken | undefined)?], CliCommandExecution | MockExecution> = sinon.stub(CliCommandExecutor.prototype, 'execute');
    mobileExecutorStub.returns(mockExecution);
    const commandOutputStub = sinon.stub(CommandOutput.prototype, 'getCmdResult');
    commandOutputStub.rejects(`${sfdxDeviceListCommand} is not a sfdx command`);

    let err: Error | null = null;
    try {
      await LWCUtils.getDeviceList(platform);
    } catch (e) {
      err = e;
    }

    expect(err?.message).to.equal(nls.localize('force_lightning_lwc_no_mobile_plugin'));
  });

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
    const platform: LWCPlatformQuickPickItem =  {
      label: nls.localize('force_lightning_lwc_ios_label'),
      detail: nls.localize('force_lightning_lwc_ios_description'),
      alwaysShow: true,
      picked: false,
      id: DevicePlatformType.iOS,
      platformName: DevicePlatformName.iOS,
      defaultTargetName: 'SFDXSimulator'
    };

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

    sandbox.stub(LWCUtils, 'getDeviceList').callsFake(() => Promise.resolve(devices));
    sandbox.stub(LWCUtils, 'getUserInput').callsFake(() => Promise.resolve(expectedDeviceName ?? ''));

    const mockQuickPick = new MockQuickPick(selectedIndex, isCancelling);
    const createQuickPickStub = sandbox.stub(vscode.window, 'createQuickPick');
    createQuickPickStub.returns(mockQuickPick);

    try {
      selectedDeviceName = await LWCUtils.selectTargetDevice(platform);
    } catch (e) {
      err = e;
    }

    expect(selectedDeviceName).to.equal(expectedDeviceName);
    if (isCancelling) {
      expect(err?.message).to.equal((new OperationCancelledException()).message);
    } else {
      expect(err).to.be.equal(null);
    }
  }

  it('Project Root Directory', async () => {
    const existsSyncStub = sandbox.stub(fs, 'existsSync');

    const lstatSyncStub = sandbox.stub(fs, 'lstatSync');
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    // returns undefined for invalid path
    expect(
      LWCUtils.getProjectRootDirectory(path.normalize('/invalidpath')) === undefined
    ).to.be.true;

    // returns undefined when path is valid but sfdx-project.json not found
    existsSyncStub.callsFake(
      fsPath => path.normalize(fsPath as string) === path.normalize('/my/path')
    );
    expect(
      LWCUtils.getProjectRootDirectory(path.normalize('/my/path')) === undefined
    ).to.be.true;

    // returns correct path when path is valid and sfdx-project.json is found
    existsSyncStub.reset();
    existsSyncStub.callsFake(
      fsPath =>
        path.normalize(fsPath as string) === path.normalize('/my/path') ||
        path.normalize(fsPath as string) ===
          path.normalize('/my/sfdx-project.json')
    );
    expect(
      LWCUtils.getProjectRootDirectory(path.normalize('/my/path')) ===
        path.normalize('/my')
    ).to.be.true;
  });

  it('Directory Level Up', async () => {
    expect(
      LWCUtils.directoryLevelUp(path.normalize('/my/path')) === path.normalize('/my')
    ).to.be.true;
    expect(
      LWCUtils.directoryLevelUp(path.normalize('/my')) === path.normalize('/')
    ).to.be.true;
    expect(
      LWCUtils.directoryLevelUp(path.normalize('/')) === undefined
    ).to.be.true;
  });

  it('getAppOptionsFromPreviewConfigFile', async () => {
    const androidPlatform: LWCPlatformQuickPickItem =  {
      label: nls.localize('force_lightning_lwc_android_label'),
      detail: nls.localize('force_lightning_lwc_android_description'),
      alwaysShow: true,
      picked: false,
      id: DevicePlatformType.Android,
      platformName: DevicePlatformName.Android,
      defaultTargetName: 'SFDXEmulator'
    };

    const iosPlatform: LWCPlatformQuickPickItem =  {
      label: nls.localize('force_lightning_lwc_ios_label'),
      detail: nls.localize('force_lightning_lwc_ios_description'),
      alwaysShow: true,
      picked: false,
      id: DevicePlatformType.iOS,
      platformName: DevicePlatformName.iOS,
      defaultTargetName: 'SFDXSimulator'
    };

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

    const existsSyncStub = sandbox.stub(fs, 'readFileSync');
    existsSyncStub.returns(appConfigFileJson);

    const iosApps = LWCUtils.getAppOptionsFromPreviewConfigFile(iosPlatform, 'mobile-apps.json');
    const androidApps = LWCUtils.getAppOptionsFromPreviewConfigFile(androidPlatform, 'mobile-apps.json');

    expect(iosApps.length).to.be.equal(1);
    expect(iosApps[0].label).to.be.equal('LWC Test App - iOS');
    expect(iosApps[0].detail).to.be.equal('com.salesforce.mobile-tooling.lwc-test-app');

    expect(androidApps.length).to.be.equal(1);
    expect(androidApps[0].label).to.be.equal('LWC Test App - Android');
    expect(androidApps[0].detail).to.be.equal('com.salesforce.mobile-tooling.lwc-test-app');
  });

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

  function doExecuteSFDXCommandTest(isAndroid: Boolean, isErrorCase: Boolean) {
    const platform: LWCPlatformQuickPickItem = isAndroid
    ? {
      label: nls.localize('force_lightning_lwc_android_label'),
      detail: nls.localize('force_lightning_lwc_android_description'),
      alwaysShow: true,
      picked: false,
      id: DevicePlatformType.Android,
      platformName: DevicePlatformName.Android,
      defaultTargetName: 'SFDXEmulator'
    }
    : {
      label: nls.localize('force_lightning_lwc_ios_label'),
      detail: nls.localize('force_lightning_lwc_ios_description'),
      alwaysShow: true,
      picked: false,
      id: DevicePlatformType.iOS,
      platformName: DevicePlatformName.iOS,
      defaultTargetName: 'SFDXSimulator'
    };

    const cmdWithArgSpy = sandbox.spy(SfdxCommandBuilder.prototype, 'withArg');
    const cmdWithFlagSpy = sandbox.spy(SfdxCommandBuilder.prototype, 'withFlag');
    const mockExecution = new MockExecution(new SfdxCommandBuilder().build());
    const mobileExecutorStub: sinon.SinonStub<[(CancellationToken | undefined)?], CliCommandExecution | MockExecution> = sinon.stub(CliCommandExecutor.prototype, 'execute');
    mobileExecutorStub.returns(mockExecution);

    let cmd = new SfdxCommandBuilder()
    .withDescription('command description')
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
      mockExecution.stdoutSubject.next(androidSuccessString);
    } else {
      const exitCode = isErrorCase ? -1 : 0;
      mockExecution.processExitSubject.next(exitCode);
    }

    expect(onErrorCalled).to.be.equal(isErrorCase ? true : false);
    expect(onSuccessCalled).to.be.equal(isErrorCase ? false : true);

    expect(cmdWithArgSpy.callCount).to.equal(1);
    expect(cmdWithArgSpy.getCall(0).args[0]).equals('mycommand');
    expect(cmdWithFlagSpy.callCount).to.equal(1);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members(['-p', platform.platformName]);
  }
});
