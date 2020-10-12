/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecution,
  CliCommandExecutor,
  Command,
  CommandBuilder,
  CommandExecution,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { CancellationToken } from '@salesforce/salesforcedx-utils-vscode/out/src/cli/commandExecutor';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { Subject } from 'rxjs/Subject';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import URI from 'vscode-uri';
import {
  DEV_SERVER_PREVIEW_ROUTE,
  DEV_SERVER_DEFAULT_BASE_URL
} from '../../../src/commands/commandConstants';
import * as commandUtils from '../../../src/commands/commandUtils';
import {
  DeviceQuickPickItem,
  directoryLevelUp,
  forceLightningLwcPreview,
  getProjectRootDirectory,
  PlatformName,
  platformOptions
} from '../../../src/commands/forceLightningLwcPreview';
import { nls } from '../../../src/messages';
import { DevServerService } from '../../../src/service/devServerService';
import { WorkspaceUtils } from '../../../src/util/workspaceUtils';
import { channelService } from '@salesforce/salesforcedx-utils-vscode/out/src/channels';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const { SfdxCommandlet, notificationService } = sfdxCoreExports;
const sfdxDeviceListCommand = 'force:lightning:local:device:list';
const sfdxMobilePreviewCommand = 'force:lightning:lwc:preview';
const rememberDeviceKey = 'preview.rememberDevice';
const logLevelKey = 'preview.logLevel';
const defaultLogLevel = 'warn';
const androidSuccessString = 'Launching... Opening Browser';

const iOSPickedDevice: DeviceQuickPickItem = {
  label: 'iPhone 8',
  detail: 'iOS 13.3',
  name: 'iPhone 8'
};
const iOSDeviceListJson = `
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
          "runtimeId":"iOS 13.3",
          "isAvailable":true
      }
    ]
  }
`;

const androidPickedDevice: DeviceQuickPickItem = {
  label: 'Pixel API 29',
  detail: 'Google APIs, API 29',
  name: 'Pixel_API_29'
};
const androidDeviceListJson = `
  {
    "status":0,
    "result":[
      {
          "name":"emu2",
          "displayName":"emu2",
          "deviceName":"pixel",
          "path":"/Users/maliroteh/.android/avd/emu2.avd",
          "target":"Default Android System Image",
          "api":"API 29"
      },
      {
          "name":"Pixel_API_29",
          "displayName":"Pixel API 29",
          "deviceName":"pixel",
          "path":"/Users/maliroteh/.android/avd/Pixel_API_29.avd",
          "target":"Google APIs",
          "api":"API 29"
      }
    ]
  }
`;

const pickedApp: vscode.QuickPickItem = {
  label: 'LWC Test App',
  detail: 'com.salesforce.mobile-tooling.lwc-test-app'
};
const appConfigFileJson = `
{
  "apps": {
    "ios": [
      {
        "id": "com.salesforce.mobile-tooling.lwc-test-app",
        "name": "LWC Test App",
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
        "name": "LWC Test App",
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

describe('forceLightningLwcPreview', () => {
  let sandbox: SinonSandbox;
  let devServiceStub: any;
  let openBrowserStub: SinonStub<[string], Thenable<boolean>>;
  let existsSyncStub: sinon.SinonStub<[fs.PathLike], boolean>;
  let lstatSyncStub: sinon.SinonStub<[fs.PathLike], fs.Stats>;
  let showErrorMessageStub: sinon.SinonStub<any[], any>;
  const root = /^win32/.test(process.platform) ? 'c:\\' : '/var';
  const mockLwcFileDirectory = path.join(
    root,
    'project',
    'force-app',
    'main',
    'default',
    'lwc',
    'foo'
  );
  const mockLwcFileDirectoryUri = URI.file(mockLwcFileDirectory);
  const mockLwcFilePath = path.join(mockLwcFileDirectory, 'foo.js');
  const mockLwcFilePathUri = URI.file(mockLwcFilePath);
  const notLwcModulePath = path.join(root, 'foo');
  const notLwcModulePathUri = URI.file(notLwcModulePath);
  const nonExistentPath = path.join(root, 'foo');
  const nonExistentPathUri = URI.file(nonExistentPath);
  let showQuickPickStub: sinon.SinonStub<
    [
      vscode.QuickPickItem[] | Thenable<vscode.QuickPickItem[]>,
      (vscode.QuickPickOptions | undefined)?,
      (vscode.CancellationToken | undefined)?
    ],
    Thenable<vscode.QuickPickItem | undefined>
  >;
  let showInputBoxStub: sinon.SinonStub<
    [
      (vscode.InputBoxOptions | undefined)?,
      (vscode.CancellationToken | undefined)?
    ],
    Thenable<string | undefined>
  >;
  let getConfigurationStub: sinon.SinonStub<any, vscode.WorkspaceConfiguration>;
  let getGlobalStoreStub: sinon.SinonStub<any, vscode.Memento | undefined>;
  let cmdWithArgSpy: sinon.SinonSpy<[string], CommandBuilder>;
  let cmdWithFlagSpy: sinon.SinonSpy<[string, string], CommandBuilder>;
  let mobileExecutorStub: sinon.SinonStub<
    [(CancellationToken | undefined)?],
    CliCommandExecution | MockExecution
  >;
  let commandOutputStub: sinon.SinonStub<[CommandExecution], Promise<string>>;
  let mockExecution: MockExecution;
  let showWarningMessageSpy: sinon.SinonSpy<any, any>;
  let successInfoMessageSpy: sinon.SinonSpy<any, any>;
  let streamCommandOutputSpy: sinon.SinonSpy<any, any>;
  let appendLineSpy: sinon.SinonSpy<any, any>;

  const desktopQuickPick = platformOptions[0];
  const androidQuickPick = platformOptions[1];
  const iOSQuickPick = platformOptions[2];
  const rememberedAndroidDevice = 'rememberedAndroid';
  const rememberediOSDevice = 'rememberediOS';

  class MockMemento implements vscode.Memento {
    public get<T>(key: string): T | undefined {
      switch (key) {
        case `last${PlatformName.Android}Device`:
          return (rememberedAndroidDevice as unknown) as T;
        case `last${PlatformName.iOS}Device`:
          return (rememberediOSDevice as unknown) as T;
        default:
          return undefined;
      }
    }
    public update(key: string, value: any): Thenable<void> {
      return Promise.resolve();
    }
  }

  class MockWorkspace implements vscode.WorkspaceConfiguration {
    // tslint:disable-next-line:member-access
    shouldRemember = false;
    // tslint:disable-next-line:member-access
    loglevel = defaultLogLevel;

    constructor(shouldRemember: boolean, loglevel?: string) {
      this.shouldRemember = shouldRemember;
      if (loglevel !== undefined) {
        this.loglevel = loglevel;
      }
    }

    readonly [key: string]: any;
    public get<T>(section: string): T | undefined;
    public get<T>(section: string, defaultValue: T): T;
    public get(section: any, defaultValue?: any) {
      switch (section) {
        case logLevelKey:
          return this.loglevel;
        case rememberDeviceKey:
          return this.shouldRemember;
        default:
          return undefined;
      }
    }
    public has(section: string): boolean {
      return this.shouldRemember;
    }
    public inspect<T>(
      section: string
    ):
      | {
          key: string;
          defaultValue?: T | undefined;
          globalValue?: T | undefined;
          workspaceValue?: T | undefined;
          workspaceFolderValue?: T | undefined;
        }
      | undefined {
      return undefined;
    }
    public update(
      section: string,
      value: any,
      configurationTarget?: boolean | vscode.ConfigurationTarget | undefined
    ): Thenable<void> {
      return Promise.resolve();
    }
  }

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

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    devServiceStub = sinon.createStubInstance(DevServerService);
    sandbox.stub(DevServerService, 'instance').get(() => devServiceStub);
    openBrowserStub = sandbox.stub(commandUtils, 'openBrowser');
    existsSyncStub = sandbox.stub(fs, 'existsSync');
    lstatSyncStub = sandbox.stub(fs, 'lstatSync');
    showErrorMessageStub = sandbox.stub(
      notificationService,
      'showErrorMessage'
    );
    showQuickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
    showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox');
    getConfigurationStub = sandbox.stub(
      WorkspaceUtils.prototype,
      'getWorkspaceSettings'
    );
    getGlobalStoreStub = sandbox.stub(
      WorkspaceUtils.prototype,
      'getGlobalStore'
    );
    cmdWithArgSpy = sandbox.spy(SfdxCommandBuilder.prototype, 'withArg');
    cmdWithFlagSpy = sandbox.spy(SfdxCommandBuilder.prototype, 'withFlag');
    mockExecution = new MockExecution(new SfdxCommandBuilder().build());
    mobileExecutorStub = sinon.stub(CliCommandExecutor.prototype, 'execute');
    mobileExecutorStub.returns(mockExecution);
    commandOutputStub = sinon.stub(CommandOutput.prototype, 'getCmdResult');
    commandOutputStub.returns(Promise.resolve('{}'));
    showWarningMessageSpy = sandbox.spy(vscode.window, 'showWarningMessage');
    successInfoMessageSpy = sandbox.spy(
      vscode.window,
      'showInformationMessage'
    );
    streamCommandOutputSpy = sandbox.stub(
      channelService,
      'streamCommandOutput'
    );
    appendLineSpy = sinon.spy(channelService, 'appendLine');
  });

  afterEach(() => {
    sinon.restore();
    sandbox.restore();
    cmdWithArgSpy.restore();
    cmdWithFlagSpy.restore();
    showWarningMessageSpy.restore();
    successInfoMessageSpy.restore();
    mobileExecutorStub.restore();
    commandOutputStub.restore();
    streamCommandOutputSpy.restore();
    appendLineSpy.restore();
  });

  function mockFileExists(mockPath: string) {
    existsSyncStub.callsFake(fsPath => {
      if (
        path.normalize(fsPath.toString()).toLowerCase() ===
        path.normalize(mockPath).toLowerCase()
      ) {
        return true;
      } else {
        return false;
      }
    });
  }

  it('exists sync called with correct path', async () => {
    // Returns false for remembered device settings.
    getConfigurationStub.returns(new MockWorkspace(false));
    devServiceStub.isServerHandlerRegistered.returns(true);
    mockFileExists(mockLwcFilePath);

    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);
    showQuickPickStub.resolves(desktopQuickPick);
    await forceLightningLwcPreview(mockLwcFilePathUri);

    sinon.assert.calledOnce(openBrowserStub);
    sinon.assert.calledOnce(existsSyncStub);
    sinon.assert.calledWith(
      existsSyncStub,
      /^win32/.test(process.platform)
        ? 'c:\\project\\force-app\\main\\default\\lwc\\foo\\foo.js'
        : '/var/project/force-app/main/default/lwc/foo/foo.js'
    );
  });

  it('calls openBrowser with the correct url for files', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);
    devServiceStub.getBaseUrl.returns(DEV_SERVER_DEFAULT_BASE_URL);
    devServiceStub.getComponentPreviewUrl.returns(
      'http://localhost:3333/preview/c/foo'
    );
    getConfigurationStub.returns(new MockWorkspace(false));
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);
    showQuickPickStub.resolves(desktopQuickPick);

    await forceLightningLwcPreview(mockLwcFilePathUri);

    sinon.assert.calledWith(
      devServiceStub.getComponentPreviewUrl,
      sinon.match('c/foo')
    );
    sinon.assert.calledOnce(openBrowserStub);
    sinon.assert.calledWith(
      openBrowserStub,
      sinon.match(
        `${DEV_SERVER_DEFAULT_BASE_URL}/${DEV_SERVER_PREVIEW_ROUTE}/c/foo`
      )
    );
  });

  it('calls openBrowser with the correct url for directories', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);
    devServiceStub.getComponentPreviewUrl.returns(
      'http://localhost:3333/preview/c/foo'
    );
    mockFileExists(mockLwcFileDirectory);
    getConfigurationStub.returns(new MockWorkspace(false));
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);
    showQuickPickStub.resolves(desktopQuickPick);

    await forceLightningLwcPreview(mockLwcFileDirectoryUri);

    sinon.assert.calledWith(
      devServiceStub.getComponentPreviewUrl,
      sinon.match('c/foo')
    );
    sinon.assert.calledOnce(openBrowserStub);
    sinon.assert.calledWith(
      openBrowserStub,
      sinon.match('http://localhost:3333/preview/c/foo')
    );
  });

  it('starts the server if it is not running when desktop selected', async () => {
    devServiceStub.isServerHandlerRegistered.returns(false);
    mockFileExists(mockLwcFilePath);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);
    showQuickPickStub.resolves(desktopQuickPick);
    const commandletStub = sandbox.stub(SfdxCommandlet.prototype, 'run');
    await forceLightningLwcPreview(mockLwcFilePathUri);

    sinon.assert.calledOnce(commandletStub);
  });

  it('starts the server if it is not running when Android selected', async () => {
    await doStartServerTest(true);
  });

  it('starts the server if it is not running when iOS selected', async () => {
    await doStartServerTest(false);
  });

  async function doStartServerTest(isAndroid: Boolean) {
    const platform = isAndroid ? PlatformName.Android : PlatformName.iOS;
    const deviceName = isAndroid ? 'SFDXEmulator' : 'SFDXSimulator';
    devServiceStub.isServerHandlerRegistered.returns(false);
    mockFileExists(mockLwcFilePath);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);
    getConfigurationStub.returns(new MockWorkspace(false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(isAndroid ? androidQuickPick : iOSQuickPick);
    showInputBoxStub.resolves('');
    const commandletStub = sandbox.stub(SfdxCommandlet.prototype, 'run');
    await forceLightningLwcPreview(mockLwcFilePathUri);

    if (isAndroid) {
      mockExecution.stdoutSubject.next(androidSuccessString);
    } else {
      mockExecution.processExitSubject.next(0);
    }

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    sinon.assert.calledOnce(commandletStub);
    expect(cmdWithArgSpy.callCount).to.equal(2);
    expect(cmdWithArgSpy.getCall(0).args[0]).equals(sfdxDeviceListCommand);
    expect(cmdWithArgSpy.getCall(1).args[0]).equals(sfdxMobilePreviewCommand);
    expect(cmdWithFlagSpy.callCount).to.equal(7);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
      '-p',
      platform
    ]);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-p',
      platform
    ]);
    expect(cmdWithFlagSpy.getCall(2).args).to.have.same.members([
      '-t',
      deviceName
    ]);
    expect(cmdWithFlagSpy.getCall(3).args).to.have.same.members([
      '-n',
      'c/foo'
    ]);
    expect(cmdWithFlagSpy.getCall(4).args).to.have.same.members([
      '-a',
      'browser'
    ]);
    expect(cmdWithFlagSpy.getCall(5).args).to.have.same.members([
      '-d',
      mockLwcFileDirectory
    ]);
    expect(cmdWithFlagSpy.getCall(6).args).to.have.same.members([
      '--loglevel',
      'warn'
    ]);
    sinon.assert.calledTwice(mobileExecutorStub); // device list + preview
    expect(successInfoMessageSpy.callCount).to.equal(1);
    expect(
      successInfoMessageSpy.calledWith(
        isAndroid
          ? nls.localize('force_lightning_lwc_android_start', deviceName)
          : nls.localize('force_lightning_lwc_ios_start', deviceName)
      )
    );
  }

  it('shows an error when source path is not recognized as an lwc module file', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);
    mockFileExists(notLwcModulePath);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);
    showQuickPickStub.resolves(desktopQuickPick);

    await forceLightningLwcPreview(notLwcModulePathUri);

    sinon.assert.calledWith(
      showErrorMessageStub,
      sinon.match(
        nls.localize(
          `force_lightning_lwc_preview_unsupported`,
          /^win32/.test(process.platform) ? 'c:\\foo' : '/var/foo'
        )
      )
    );
  });

  it('shows an error when source path does not exist', async () => {
    mockFileExists(nonExistentPath);
    devServiceStub.isServerHandlerRegistered.returns(true);
    existsSyncStub.returns(false);
    showQuickPickStub.resolves(desktopQuickPick);

    await forceLightningLwcPreview(nonExistentPathUri);

    sinon.assert.calledWith(
      showErrorMessageStub,
      sinon.match(
        nls.localize(
          `force_lightning_lwc_preview_file_nonexist`,
          /^win32/.test(process.platform) ? 'c:\\foo' : '/var/foo'
        )
      )
    );
  });

  it('shows an error message when open browser throws an error', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);
    mockFileExists(mockLwcFileDirectory);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    showQuickPickStub.resolves(desktopQuickPick);
    openBrowserStub.throws('test error');

    await forceLightningLwcPreview(mockLwcFileDirectoryUri);

    const commandName = nls.localize(`force_lightning_lwc_preview_text`);
    sinon.assert.calledTwice(showErrorMessageStub);
    sinon.assert.calledWith(
      showErrorMessageStub,
      sinon.match(nls.localize('command_failure', commandName))
    );
  });

  it('calls SFDX preview with the correct url for files', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves('');
    await forceLightningLwcPreview(mockLwcFilePathUri);
    mockExecution.stdoutSubject.next(androidSuccessString);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithArgSpy.callCount).to.equal(2);
    expect(cmdWithArgSpy.getCall(0).args[0]).equals(sfdxDeviceListCommand);
    expect(cmdWithArgSpy.getCall(1).args[0]).equals(sfdxMobilePreviewCommand);
    expect(cmdWithFlagSpy.callCount).to.equal(7);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
      '-p',
      PlatformName.Android
    ]);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-p',
      PlatformName.Android
    ]);
    expect(cmdWithFlagSpy.getCall(2).args).to.have.same.members([
      '-t',
      'SFDXEmulator'
    ]);
    expect(cmdWithFlagSpy.getCall(3).args).to.have.same.members([
      '-n',
      'c/foo'
    ]);
    expect(cmdWithFlagSpy.getCall(4).args).to.have.same.members([
      '-a',
      'browser'
    ]);
    expect(cmdWithFlagSpy.getCall(5).args).to.have.same.members([
      '-d',
      mockLwcFileDirectory
    ]);
    expect(cmdWithFlagSpy.getCall(6).args).to.have.same.members([
      '--loglevel',
      'warn'
    ]);
    sinon.assert.calledTwice(mobileExecutorStub); // device list + preview
    expect(successInfoMessageSpy.callCount).to.equal(1);
  });

  it('calls SFDX preview with the correct url for directories', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(iOSQuickPick);
    showInputBoxStub.resolves('');
    await forceLightningLwcPreview(mockLwcFileDirectoryUri);
    mockExecution.processExitSubject.next(0);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithArgSpy.callCount).to.equal(2);
    expect(cmdWithArgSpy.getCall(0).args[0]).equals(sfdxDeviceListCommand);
    expect(cmdWithArgSpy.getCall(1).args[0]).equals(sfdxMobilePreviewCommand);
    expect(cmdWithFlagSpy.callCount).to.equal(7);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
      '-p',
      PlatformName.iOS
    ]);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-p',
      PlatformName.iOS
    ]);
    expect(cmdWithFlagSpy.getCall(2).args).to.have.same.members([
      '-t',
      'SFDXSimulator'
    ]);
    expect(cmdWithFlagSpy.getCall(3).args).to.have.same.members([
      '-n',
      'c/foo'
    ]);
    expect(cmdWithFlagSpy.getCall(4).args).to.have.same.members([
      '-a',
      'browser'
    ]);
    expect(cmdWithFlagSpy.getCall(5).args).to.have.same.members([
      '-d',
      mockLwcFileDirectoryUri.fsPath
    ]);
    expect(cmdWithFlagSpy.getCall(6).args).to.have.same.members([
      '--loglevel',
      'warn'
    ]);
    sinon.assert.calledTwice(mobileExecutorStub); // device list + preview
    expect(successInfoMessageSpy.callCount).to.equal(1);
  });

  it('shows an error when source path is not recognized as an lwc module file', async () => {
    mockFileExists(notLwcModulePath);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves('test');
    await forceLightningLwcPreview(notLwcModulePathUri);

    sinon.assert.calledWith(
      showErrorMessageStub,
      sinon.match(
        nls.localize(
          `force_lightning_lwc_preview_unsupported`,
          /^win32/.test(process.platform) ? 'c:\\foo' : '/var/foo'
        )
      )
    );
    sinon.assert.notCalled(mobileExecutorStub);
    expect(successInfoMessageSpy.callCount).to.equal(0);
  });

  it('shows an error when source path does not exist', async () => {
    mockFileExists(nonExistentPath);
    existsSyncStub.returns(false);
    getConfigurationStub.returns(new MockWorkspace(false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves(undefined);
    await forceLightningLwcPreview(nonExistentPathUri);

    sinon.assert.calledWith(
      showErrorMessageStub,
      sinon.match(
        nls.localize(
          `force_lightning_lwc_preview_file_nonexist`,
          /^win32/.test(process.platform) ? 'c:\\foo' : '/var/foo'
        )
      )
    );
    sinon.assert.notCalled(mobileExecutorStub);
    expect(successInfoMessageSpy.callCount).to.equal(0);
  });

  it('calls SFDX preview with specified Android device name', async () => {
    await doSpecifiedDeviceTest(true);
  });

  it('calls SFDX preview with specified iOS device name', async () => {
    await doSpecifiedDeviceTest(false);
  });

  async function doSpecifiedDeviceTest(isAndroid: Boolean) {
    const deviceName = isAndroid ? 'androidtestname' : 'iostestname';
    const platform = isAndroid ? PlatformName.Android : PlatformName.iOS;
    devServiceStub.isServerHandlerRegistered.returns(true);
    mockFileExists(mockLwcFileDirectory);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(isAndroid ? androidQuickPick : iOSQuickPick);
    showInputBoxStub.resolves(deviceName);

    await forceLightningLwcPreview(mockLwcFileDirectoryUri);
    if (isAndroid) {
      mockExecution.stdoutSubject.next(androidSuccessString);
    } else {
      mockExecution.processExitSubject.next(0);
    }

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
      '-p',
      platform
    ]);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-p',
      platform
    ]);
    expect(cmdWithFlagSpy.getCall(2).args).to.have.same.members([
      '-t',
      deviceName
    ]);
    sinon.assert.calledTwice(mobileExecutorStub); // device list + preview
    expect(successInfoMessageSpy.callCount).to.equal(1);
    expect(
      successInfoMessageSpy.calledWith(
        isAndroid
          ? nls.localize('force_lightning_lwc_android_start', deviceName)
          : nls.localize('force_lightning_lwc_ios_start', deviceName)
      )
    );
  }

  it('calls SFDX preview with remembered Android device name', async () => {
    await doRememberedDeviceTest(true);
  });

  it('calls SFDX preview with remembered iOS device name', async () => {
    await doRememberedDeviceTest(false);
  });

  async function doRememberedDeviceTest(isAndroid: Boolean) {
    devServiceStub.isServerHandlerRegistered.returns(true);
    mockFileExists(mockLwcFilePath);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(true));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(isAndroid ? androidQuickPick : iOSQuickPick);
    showInputBoxStub.resolves('');
    await forceLightningLwcPreview(mockLwcFilePathUri);

    if (isAndroid) {
      mockExecution.stdoutSubject.next(androidSuccessString);
    } else {
      mockExecution.processExitSubject.next(0);
    }

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);

    const platform = isAndroid ? PlatformName.Android : PlatformName.iOS;
    const deviceName = isAndroid
      ? rememberedAndroidDevice
      : rememberediOSDevice;

    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
      '-p',
      platform
    ]);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-p',
      platform
    ]);
    expect(cmdWithFlagSpy.getCall(2).args).to.have.same.members([
      '-t',
      deviceName
    ]);
    sinon.assert.calledTwice(mobileExecutorStub); // device list + preview
    expect(successInfoMessageSpy.callCount).to.equal(1);
    expect(
      successInfoMessageSpy.calledWith(
        isAndroid
          ? nls.localize('force_lightning_lwc_android_start', deviceName)
          : nls.localize('force_lightning_lwc_ios_start', deviceName)
      )
    );
  }

  it('shows warning when you cancel Android device name input', async () => {
    await doCancelledExecutionTest(true);
  });

  it('shows warning when you cancel iOS device name input', async () => {
    await doCancelledExecutionTest(false);
  });

  async function doCancelledExecutionTest(isAndroid: Boolean) {
    mockFileExists(mockLwcFilePath);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(true));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(isAndroid ? androidQuickPick : iOSQuickPick);
    // This simulates the user hitting the escape key to cancel input.
    showInputBoxStub.resolves(undefined);
    await forceLightningLwcPreview(mockLwcFilePathUri);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithArgSpy.callCount).to.equal(1);
    expect(cmdWithFlagSpy.callCount).to.equal(1);
    sinon.assert.calledOnce(mobileExecutorStub); // device list only (no preview)
    expect(
      showWarningMessageSpy.calledWith(
        nls.localize('force_lightning_lwc_operation_cancelled')
      )
    );
  }

  it('shows error in console when Android SFDX execution fails', async () => {
    await doFailedExecutionTest(true);
  });

  it('shows error in console when iOS SFDX execution fails', async () => {
    await doFailedExecutionTest(false);
  });

  async function doFailedExecutionTest(isAndroid: Boolean) {
    devServiceStub.isServerHandlerRegistered.returns(true);
    mockFileExists(mockLwcFilePath);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(isAndroid ? androidQuickPick : iOSQuickPick);
    showInputBoxStub.resolves('');
    await forceLightningLwcPreview(mockLwcFilePathUri);
    mockExecution.processExitSubject.next(1);

    sinon.assert.calledTwice(mobileExecutorStub); // device list + preview
    sinon.assert.calledTwice(showErrorMessageStub);
    sinon.assert.calledWith(
      showErrorMessageStub,
      sinon.match(
        isAndroid
          ? nls.localize(
              'force_lightning_lwc_android_failure',
              androidQuickPick.defaultTargetName
            )
          : nls.localize(
              'force_lightning_lwc_ios_failure',
              iOSQuickPick.defaultTargetName
            )
      )
    );
    sinon.assert.calledOnce(streamCommandOutputSpy);
    expect(successInfoMessageSpy.callCount).to.equal(0);
  }

  it('shows install message if sfdx plugin is not installed', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);
    mockFileExists(mockLwcFilePath);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves('');

    commandOutputStub.returns(
      Promise.reject(`${sfdxDeviceListCommand} is not a sfdx command.`)
    );

    await forceLightningLwcPreview(mockLwcFilePathUri);

    sinon.assert.calledOnce(mobileExecutorStub); // device list only

    sinon.assert.calledWith(
      showErrorMessageStub,
      sinon.match(nls.localize('force_lightning_lwc_no_mobile_plugin'))
    );

    sinon.assert.notCalled(streamCommandOutputSpy);
    sinon.assert.notCalled(successInfoMessageSpy);

    sinon.assert.calledOnce(appendLineSpy);
    expect(
      appendLineSpy.calledWith(
        nls.localize('force_lightning_lwc_no_mobile_plugin')
      )
    );
  });

  it('correct log level is used when the setting is changed', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);
    mockFileExists(mockLwcFilePath);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(false, 'debug'));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves('');
    await forceLightningLwcPreview(mockLwcFilePathUri);
    mockExecution.stdoutSubject.next(androidSuccessString);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithArgSpy.callCount).to.equal(2);
    expect(cmdWithArgSpy.getCall(0).args[0]).equals(sfdxDeviceListCommand);
    expect(cmdWithArgSpy.getCall(1).args[0]).equals(sfdxMobilePreviewCommand);
    expect(cmdWithFlagSpy.callCount).to.equal(7);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
      '-p',
      PlatformName.Android
    ]);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-p',
      PlatformName.Android
    ]);
    expect(cmdWithFlagSpy.getCall(2).args).to.have.same.members([
      '-t',
      'SFDXEmulator'
    ]);
    expect(cmdWithFlagSpy.getCall(3).args).to.have.same.members([
      '-n',
      'c/foo'
    ]);
    expect(cmdWithFlagSpy.getCall(4).args).to.have.same.members([
      '-a',
      'browser'
    ]);
    expect(cmdWithFlagSpy.getCall(5).args).to.have.same.members([
      '-d',
      mockLwcFileDirectory
    ]);
    expect(cmdWithFlagSpy.getCall(6).args).to.have.same.members([
      '--loglevel',
      'debug'
    ]);
    sinon.assert.calledTwice(mobileExecutorStub); // device list + preview
    expect(successInfoMessageSpy.callCount).to.equal(1);
  });

  it('Shows device pick list for Android devices', async () => {
    await doDeviceListQuickPickTest(true);
  });

  it('Shows device pick list for iOS devices', async () => {
    await doDeviceListQuickPickTest(false);
  });

  async function doDeviceListQuickPickTest(isAndroid: Boolean) {
    devServiceStub.isServerHandlerRegistered.returns(true);
    mockFileExists(mockLwcFileDirectory);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub
      .onFirstCall()
      .resolves(isAndroid ? androidQuickPick : iOSQuickPick);
    showQuickPickStub
      .onSecondCall()
      .resolves(isAndroid ? androidPickedDevice : iOSPickedDevice);
    commandOutputStub.returns(
      Promise.resolve(isAndroid ? androidDeviceListJson : iOSDeviceListJson)
    );

    await forceLightningLwcPreview(mockLwcFileDirectoryUri);

    if (isAndroid) {
      mockExecution.stdoutSubject.next(androidSuccessString);
    } else {
      mockExecution.processExitSubject.next(0);
    }

    sinon.assert.calledTwice(showQuickPickStub); // platform + device list
    sinon.assert.notCalled(showInputBoxStub);

    const platform = isAndroid ? PlatformName.Android : PlatformName.iOS;
    const deviceName = isAndroid
      ? androidPickedDevice.name
      : iOSPickedDevice.name;

    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
      '-p',
      platform
    ]);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-p',
      platform
    ]);
    expect(cmdWithFlagSpy.getCall(2).args).to.have.same.members([
      '-t',
      deviceName
    ]);

    sinon.assert.calledTwice(mobileExecutorStub); // device list + preview

    expect(successInfoMessageSpy.callCount).to.equal(1);
    expect(
      successInfoMessageSpy.calledWith(
        isAndroid
          ? nls.localize('force_lightning_lwc_android_start', deviceName)
          : nls.localize('force_lightning_lwc_ios_start', deviceName)
      )
    );
  }

  it('Shows input box when choosing New from device pick list for Android devices', async () => {
    await doNewDeviceQuickPickTest(true);
  });

  it('Shows input box when choosing New from device pick list for iOS devices', async () => {
    await doNewDeviceQuickPickTest(false);
  });

  async function doNewDeviceQuickPickTest(isAndroid: Boolean) {
    const deviceName = isAndroid ? 'androidtestname' : 'iostestname';
    const platform = isAndroid ? PlatformName.Android : PlatformName.iOS;
    devServiceStub.isServerHandlerRegistered.returns(true);
    mockFileExists(mockLwcFileDirectory);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub
      .onFirstCall()
      .resolves(isAndroid ? androidQuickPick : iOSQuickPick);
    showQuickPickStub.onSecondCall().resolvesArg(0);
    showInputBoxStub.resolves(deviceName);
    commandOutputStub.returns(
      Promise.resolve(isAndroid ? androidDeviceListJson : iOSDeviceListJson)
    );

    await forceLightningLwcPreview(mockLwcFileDirectoryUri);

    if (isAndroid) {
      mockExecution.stdoutSubject.next(androidSuccessString);
    } else {
      mockExecution.processExitSubject.next(0);
    }

    sinon.assert.calledTwice(showQuickPickStub); // platform + device list
    sinon.assert.calledOnce(showInputBoxStub);

    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
      '-p',
      platform
    ]);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-p',
      platform
    ]);
    expect(cmdWithFlagSpy.getCall(2).args).to.have.same.members([
      '-t',
      deviceName
    ]);

    sinon.assert.calledTwice(mobileExecutorStub); // device list + preview

    expect(successInfoMessageSpy.callCount).to.equal(1);
    expect(
      successInfoMessageSpy.calledWith(
        isAndroid
          ? nls.localize('force_lightning_lwc_android_start', deviceName)
          : nls.localize('force_lightning_lwc_ios_start', deviceName)
      )
    );
  }

  it('Picks an app from app pick list for Android apps', async () => {
    await doAppListQuickPickTest(true, pickedApp, false);
  });

  it('Picks an app from app pick list for iOS apps', async () => {
    await doAppListQuickPickTest(false, pickedApp, false);
  });

  it('Picks browser from app pick list for Android apps', async () => {
    await doAppListQuickPickTest(true, 'browser', true);
  });

  it('Picks browser from app pick list for iOS apps', async () => {
    await doAppListQuickPickTest(false, 'browser', true);
  });

  async function doAppListQuickPickTest(
    isAndroid: Boolean,
    selectedApp: vscode.QuickPickItem | 'browser',
    lwcLocationIsDirectory: boolean
  ) {
    const targetApp =
      selectedApp === 'browser' ? 'browser' : selectedApp.detail;

    devServiceStub.isServerHandlerRegistered.returns(true);
    if (lwcLocationIsDirectory) {
      mockFileExists(mockLwcFileDirectory);
    } else {
      mockFileExists(mockLwcFilePath);
    }

    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return lwcLocationIsDirectory;
      }
    } as fs.Stats);
    sinon.stub(fs, 'readFileSync').returns(appConfigFileJson);

    getConfigurationStub.returns(new MockWorkspace(false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub
      .onFirstCall()
      .resolves(isAndroid ? androidQuickPick : iOSQuickPick);
    showQuickPickStub
      .onSecondCall()
      .resolves(isAndroid ? androidPickedDevice : iOSPickedDevice);
    if (selectedApp === 'browser') {
      showQuickPickStub.onThirdCall().callsFake(args => {
        const items = args as vscode.QuickPickItem[];
        return Promise.resolve(items[0]);
      });
    } else {
      showQuickPickStub.onThirdCall().resolves(selectedApp);
    }
    commandOutputStub.returns(
      Promise.resolve(isAndroid ? androidDeviceListJson : iOSDeviceListJson)
    );

    await forceLightningLwcPreview(
      lwcLocationIsDirectory ? mockLwcFileDirectoryUri : mockLwcFilePathUri
    );

    if (isAndroid) {
      mockExecution.stdoutSubject.next(androidSuccessString);
    } else {
      mockExecution.processExitSubject.next(0);
    }

    sinon.assert.calledThrice(showQuickPickStub); // platform + device list + app list

    const platform = isAndroid ? PlatformName.Android : PlatformName.iOS;
    const deviceName = isAndroid
      ? androidPickedDevice.name
      : iOSPickedDevice.name;
    const projectRootDir = mockLwcFileDirectoryUri.fsPath;
    const configFile = path.join(projectRootDir, 'mobile-apps.json');

    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
      '-p',
      platform
    ]);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-p',
      platform
    ]);
    expect(cmdWithFlagSpy.getCall(2).args).to.have.same.members([
      '-t',
      deviceName
    ]);
    expect(cmdWithFlagSpy.getCall(3).args).to.have.same.members([
      '-n',
      'c/foo'
    ]);
    expect(cmdWithFlagSpy.getCall(4).args).to.have.same.members([
      '-a',
      targetApp
    ]);
    expect(cmdWithFlagSpy.getCall(5).args).to.have.same.members([
      '-d',
      projectRootDir
    ]);

    if (selectedApp === 'browser') {
      expect(cmdWithFlagSpy.getCall(6).args).to.have.same.members([
        '--loglevel',
        'warn'
      ]);
    } else {
      expect(cmdWithFlagSpy.getCall(6).args).to.have.same.members([
        '-f',
        configFile
      ]);
      expect(cmdWithFlagSpy.getCall(7).args).to.have.same.members([
        '--loglevel',
        'warn'
      ]);
    }

    sinon.assert.calledTwice(mobileExecutorStub); // device list + preview

    expect(successInfoMessageSpy.callCount).to.equal(1);
    expect(
      successInfoMessageSpy.calledWith(
        isAndroid
          ? nls.localize('force_lightning_lwc_android_start', deviceName)
          : nls.localize('force_lightning_lwc_ios_start', deviceName)
      )
    );
  }

  it('Cancels Preview if user cancels platform selection', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);
    devServiceStub.getBaseUrl.returns(DEV_SERVER_DEFAULT_BASE_URL);
    devServiceStub.getComponentPreviewUrl.returns(
      'http://localhost:3333/preview/c/foo'
    );
    getConfigurationStub.returns(new MockWorkspace(false));
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);
    showQuickPickStub.resolves(undefined);

    await forceLightningLwcPreview(mockLwcFilePathUri);

    sinon.assert.calledOnce(showQuickPickStub); // platform
    sinon.assert.notCalled(cmdWithFlagSpy);
    expect(
      showWarningMessageSpy.calledWith(
        nls.localize('force_lightning_lwc_operation_cancelled')
      )
    );
  });

  it('Cancels Preview if user cancels selecting target device', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);
    devServiceStub.getBaseUrl.returns(DEV_SERVER_DEFAULT_BASE_URL);
    devServiceStub.getComponentPreviewUrl.returns(
      'http://localhost:3333/preview/c/foo'
    );
    getConfigurationStub.returns(new MockWorkspace(false));
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);
    showQuickPickStub.onFirstCall().resolves(androidQuickPick);
    showQuickPickStub.onSecondCall().resolves(undefined);

    await forceLightningLwcPreview(mockLwcFilePathUri);

    sinon.assert.calledOnce(showQuickPickStub); // platform
    sinon.assert.calledOnce(cmdWithFlagSpy); // device list
    expect(
      showWarningMessageSpy.calledWith(
        nls.localize('force_lightning_lwc_operation_cancelled')
      )
    );
  });

  it('Cancels Preview if user cancels selecting target app', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);
    devServiceStub.getBaseUrl.returns(DEV_SERVER_DEFAULT_BASE_URL);
    devServiceStub.getComponentPreviewUrl.returns(
      'http://localhost:3333/preview/c/foo'
    );
    getConfigurationStub.returns(new MockWorkspace(false));
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);
    showQuickPickStub.onFirstCall().resolves(androidQuickPick);
    showQuickPickStub.onSecondCall().resolves(androidPickedDevice);
    showQuickPickStub.onThirdCall().resolves(undefined);

    await forceLightningLwcPreview(mockLwcFilePathUri);

    sinon.assert.calledOnce(showQuickPickStub); // platform + device list
    sinon.assert.calledOnce(cmdWithFlagSpy); // device list
    expect(
      showWarningMessageSpy.calledWith(
        nls.localize('force_lightning_lwc_operation_cancelled')
      )
    );
  });

  it('Directory Level Up', async () => {
    expect(
      directoryLevelUp(path.normalize('/my/path')) === path.normalize('/my')
    ).to.be.true;
    expect(directoryLevelUp(path.normalize('/my')) === path.normalize('/')).to
      .be.true;
    expect(directoryLevelUp(path.normalize('/')) === undefined).to.be.true;
  });

  it('Project Root Directory', async () => {
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    // returns undefined for invalid path
    expect(
      getProjectRootDirectory(path.normalize('/invalidpath')) === undefined
    ).to.be.true;

    // returns undefined when path is valid but sfdx-project.json not found
    existsSyncStub.callsFake(
      fsPath => path.normalize(fsPath as string) === path.normalize('/my/path')
    );

    // returns correct path when path is valid and sfdx-project.json is found
    existsSyncStub.reset();
    existsSyncStub.callsFake(
      fsPath =>
        path.normalize(fsPath as string) === path.normalize('/my/path') ||
        path.normalize(fsPath as string) ===
          path.normalize('/my/sfdx-project.json')
    );
    expect(
      getProjectRootDirectory(path.normalize('/my/path')) ===
        path.normalize('/my')
    ).to.be.true;
  });
});
