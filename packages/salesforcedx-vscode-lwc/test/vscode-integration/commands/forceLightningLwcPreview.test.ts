/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  CommandBuilder,
  CommandExecution,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { CliCommandExecution } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { CancellationToken } from '@salesforce/salesforcedx-utils-vscode/out/src/cli/commandExecutor';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { Subject } from 'rxjs/Subject';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import URI from 'vscode-uri';
import { DEV_SERVER_PREVIEW_ROUTE } from '../../../src/commands/commandConstants';
import * as commandUtils from '../../../src/commands/commandUtils';
import {
  androidSuccessString,
  defaultLogLevel,
  forceLightningLwcPreview,
  logLevelKey,
  platformOptions,
  mobileEnabledKey,
  rememberDeviceKey,
  sfdxMobilePreviewCommand
} from '../../../src/commands/forceLightningLwcPreview';
import { nls } from '../../../src/messages';
import { DevServerService } from '../../../src/service/devServerService';
import * as utils from '../../../src/';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const { channelService, SfdxCommandlet, notificationService } = sfdxCoreExports;

describe('forceLightningLwcPreview', () => {
  let sandbox: SinonSandbox;
  let devServiceStub: any;
  let openBrowserStub: SinonStub<[string], Thenable<boolean>>;
  let existsSyncStub: sinon.SinonStub<[fs.PathLike], boolean>;
  let lstatSyncStub: sinon.SinonStub<[fs.PathLike], fs.Stats>;
  let showErrorMessageStub: sinon.SinonStub<any[], any>;
  const root = /^win32/.test(process.platform) ? 'C:\\' : '/var';
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
  let getGlobalStoreStub: sinon.SinonStub<any, vscode.Memento>;
  let cmdWithArgSpy: sinon.SinonSpy<[string], CommandBuilder>;
  let cmdWithFlagSpy: sinon.SinonSpy<[string, string], CommandBuilder>;
  let mobileExecutorStub: sinon.SinonStub<
    [(CancellationToken | undefined)?],
    CliCommandExecution | MockExecution
  >;
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
  const startCommand = 'force:lightning:lwc:start';

  class MockMemento implements vscode.Memento {
    public get<T>(key: string): T | undefined {
      switch (key) {
        case 'lastAndroidDevice':
          return (rememberedAndroidDevice as unknown) as T;
        case 'lastiOSDevice':
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
    mobileEnabled = false;
    // tslint:disable-next-line:member-access
    shouldRemember = false;
    // tslint:disable-next-line:member-access
    loglevel = defaultLogLevel;

    constructor(
      mobileEnabled: boolean,
      shouldRemember: boolean,
      loglevel?: string
    ) {
      this.mobileEnabled = mobileEnabled;
      this.shouldRemember = shouldRemember;
      if (loglevel !== undefined) {
        this.loglevel = loglevel;
      }
    }

    readonly [key: string]: any;
    public get<T>(section: string): T | undefined;
    public get<T>(section: string, defaultValue: T): T;
    public get(section: any, defaultValue?: any) {
      if (section === logLevelKey) {
        return this.loglevel;
      } else if (section === mobileEnabledKey) {
        return this.mobileEnabled;
      } else if (section === rememberDeviceKey) {
        return this.shouldRemember;
      } else {
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
    private readonly childProcessPid: any;

    constructor(command: Command) {
      this.command = command;
      this.processExitSubject = new Subject<number>();
      this.processErrorSubject = new Subject<Error>();
      this.stdoutSubject = new Subject<string>();
      this.stderrSubject = new Subject<string>();
      this.childProcessPid = '';
    }

    public killExecution(signal?: string): Promise<void> {
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
    getConfigurationStub = sandbox.stub(utils, 'getWorkspaceSettings');
    getGlobalStoreStub = sandbox.stub(utils, 'getGlobalStore');
    cmdWithArgSpy = sandbox.spy(SfdxCommandBuilder.prototype, 'withArg');
    cmdWithFlagSpy = sandbox.spy(SfdxCommandBuilder.prototype, 'withFlag');
    mockExecution = new MockExecution(new SfdxCommandBuilder().build());
    mobileExecutorStub = sinon.stub(CliCommandExecutor.prototype, 'execute');
    mobileExecutorStub.returns(mockExecution);
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
    sandbox.restore();
    cmdWithArgSpy.restore();
    cmdWithFlagSpy.restore();
    showWarningMessageSpy.restore();
    successInfoMessageSpy.restore();
    mobileExecutorStub.restore();
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
    devServiceStub.isServerHandlerRegistered.returns(true);
    mockFileExists(mockLwcFilePath);

    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    await forceLightningLwcPreview(mockLwcFilePathUri);

    sinon.assert.calledOnce(existsSyncStub);
    sinon.assert.calledWith(
      existsSyncStub,
      /^win32/.test(process.platform)
        ? 'c:\\project\\force-app\\main\\default\\lwc\\foo\\foo.js'
        : '/var/project/force-app/main/default/lwc/foo/foo.js'
    );
  });

  it('calls openBrowser with the correct url for files', async () => {
    getConfigurationStub.returns(new MockWorkspace(false, false));
    devServiceStub.isServerHandlerRegistered.returns(true);
    mockFileExists(mockLwcFilePath);

    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    await forceLightningLwcPreview(mockLwcFilePathUri);

    sinon.assert.calledOnce(openBrowserStub);
    sinon.assert.calledWith(
      openBrowserStub,
      sinon.match(`${DEV_SERVER_PREVIEW_ROUTE}/c/foo`)
    );
  });

  it('calls openBrowser with the correct url for directories', async () => {
    getConfigurationStub.returns(new MockWorkspace(false, false));
    devServiceStub.isServerHandlerRegistered.returns(true);
    mockFileExists(mockLwcFileDirectory);

    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    await forceLightningLwcPreview(mockLwcFileDirectoryUri);

    sinon.assert.calledOnce(openBrowserStub);
    sinon.assert.calledWith(
      openBrowserStub,
      sinon.match(`${DEV_SERVER_PREVIEW_ROUTE}/c/foo`)
    );
  });

  it('starts the server if it is not running yet', async () => {
    getConfigurationStub.returns(new MockWorkspace(false, false));
    devServiceStub.isServerHandlerRegistered.returns(false);
    mockFileExists(mockLwcFilePath);

    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    const commandletStub = sandbox.stub(SfdxCommandlet.prototype, 'run');
    await forceLightningLwcPreview(mockLwcFilePathUri);

    sinon.assert.calledOnce(commandletStub);
  });

  it('shows an error when source path is not recognized as an lwc module file', async () => {
    getConfigurationStub.returns(new MockWorkspace(false, false));
    devServiceStub.isServerHandlerRegistered.returns(true);

    const notLwcModulePath = path.join(root, 'foo');
    const sourceUri = URI.file(notLwcModulePath);
    mockFileExists(notLwcModulePath);

    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    await forceLightningLwcPreview(sourceUri);

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
    getConfigurationStub.returns(new MockWorkspace(false, false));
    devServiceStub.isServerHandlerRegistered.returns(true);

    const nonExistentPath = path.join(root, 'foo');
    const sourceUri = URI.file(nonExistentPath);

    existsSyncStub.returns(false);

    await forceLightningLwcPreview(sourceUri);

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
    getConfigurationStub.returns(new MockWorkspace(false, false));
    devServiceStub.isServerHandlerRegistered.returns(true);
    mockFileExists(mockLwcFilePath);

    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    openBrowserStub.throws('test error');

    await forceLightningLwcPreview(mockLwcFilePathUri);

    const commandName = nls.localize(`force_lightning_lwc_preview_text`);
    sinon.assert.calledTwice(showErrorMessageStub);
    sinon.assert.calledWith(
      showErrorMessageStub,
      sinon.match(nls.localize('command_failure', commandName))
    );
  });

  // Tests for new picklist UI that includes Desktop, Android and iOS.
  it('calls SFDX preview with the correct url for files', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);
    mockFileExists(mockLwcFilePath);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(true, false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves('');
    await forceLightningLwcPreview(mockLwcFilePathUri);
    mockExecution.stdoutSubject.next(androidSuccessString);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithArgSpy.callCount).to.equal(1);
    expect(cmdWithArgSpy.getCall(0).args[0]).equals(sfdxMobilePreviewCommand);
    expect(cmdWithFlagSpy.callCount).to.equal(4);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
      '-p',
      'Android'
    ]);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-t',
      'SFDXEmulator'
    ]);
    expect(cmdWithFlagSpy.getCall(2).args).to.have.same.members([
      '-n',
      'c/foo'
    ]);
    expect(cmdWithFlagSpy.getCall(3).args).to.have.same.members([
      '--loglevel',
      'warn'
    ]);
    sinon.assert.calledOnce(mobileExecutorStub);
    expect(successInfoMessageSpy.callCount).to.equal(1);
  });

  it('calls SFDX preview with the correct url for directories', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);
    mockFileExists(mockLwcFileDirectory);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(true, false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(iOSQuickPick);
    showInputBoxStub.resolves('');
    await forceLightningLwcPreview(mockLwcFileDirectoryUri);
    mockExecution.processExitSubject.next(0);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithArgSpy.callCount).to.equal(1);
    expect(cmdWithArgSpy.getCall(0).args[0]).equals(sfdxMobilePreviewCommand);
    expect(cmdWithFlagSpy.callCount).to.equal(4);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members(['-p', 'iOS']);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-t',
      'SFDXSimulator'
    ]);
    expect(cmdWithFlagSpy.getCall(2).args).to.have.same.members([
      '-n',
      'c/foo'
    ]);
    expect(cmdWithFlagSpy.getCall(3).args).to.have.same.members([
      '--loglevel',
      'warn'
    ]);
    sinon.assert.calledOnce(mobileExecutorStub);
    expect(successInfoMessageSpy.callCount).to.equal(1);
  });

  it('shows an error when source path is not recognized as an lwc module file', async () => {
    const testPath = path.join('foo');
    const sourceUri = { path: testPath } as vscode.Uri;

    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(true, false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves('test');
    await forceLightningLwcPreview(sourceUri);

    sinon.assert.calledWith(
      showErrorMessageStub,
      sinon.match(
        nls.localize(`force_lightning_lwc_preview_unsupported`, 'foo')
      )
    );
    sinon.assert.notCalled(mobileExecutorStub);
    expect(successInfoMessageSpy.callCount).to.equal(0);
  });

  it('shows an error when source path does not exist', async () => {
    const testPath = path.join('foo');
    const sourceUri = { path: testPath } as vscode.Uri;

    existsSyncStub.returns(false);
    getConfigurationStub.returns(new MockWorkspace(true, false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves(undefined);
    await forceLightningLwcPreview(sourceUri);

    sinon.assert.calledWith(
      showErrorMessageStub,
      sinon.match(
        nls.localize(`force_lightning_lwc_preview_file_nonexist`, 'foo')
      )
    );
    sinon.assert.notCalled(mobileExecutorStub);
    expect(successInfoMessageSpy.callCount).to.equal(0);
  });

  it('calls SFDX preview with specified Android device name', async () => {
    const deviceName = 'androidtestname';
    devServiceStub.isServerHandlerRegistered.returns(true);
    mockFileExists(mockLwcFileDirectory);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    devServiceStub.isServerHandlerRegistered.returns(true);
    getConfigurationStub.returns(new MockWorkspace(true, false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves(deviceName);
    await forceLightningLwcPreview(mockLwcFileDirectoryUri);
    mockExecution.stdoutSubject.next(androidSuccessString);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
      '-p',
      'Android'
    ]);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-t',
      deviceName
    ]);
    sinon.assert.calledOnce(mobileExecutorStub);
    expect(successInfoMessageSpy.callCount).to.equal(1);
    expect(
      successInfoMessageSpy.calledWith(
        nls.localize('force_lightning_lwc_mobile_android_start', deviceName)
      )
    );
  });

  it('calls SFDX preview with specified iOS device name', async () => {
    const deviceName = 'iostestname';
    mockFileExists(mockLwcFilePath);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    devServiceStub.isServerHandlerRegistered.returns(true);
    getConfigurationStub.returns(new MockWorkspace(true, false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(iOSQuickPick);
    showInputBoxStub.resolves(deviceName);
    await forceLightningLwcPreview(mockLwcFilePathUri);
    mockExecution.processExitSubject.next(0);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members(['-p', 'iOS']);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-t',
      deviceName
    ]);
    sinon.assert.calledOnce(mobileExecutorStub);
    expect(successInfoMessageSpy.callCount).to.equal(1);
    expect(
      successInfoMessageSpy.calledWith(
        nls.localize('force_lightning_lwc_ios_start', deviceName)
      )
    );
  });

  it('calls SFDX preview with remembered Android device name', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);
    mockFileExists(mockLwcFilePath);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(true, true));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves('');
    await forceLightningLwcPreview(mockLwcFilePathUri);
    mockExecution.stdoutSubject.next(androidSuccessString);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
      '-p',
      'Android'
    ]);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-t',
      rememberedAndroidDevice
    ]);
    sinon.assert.calledOnce(mobileExecutorStub);
    expect(successInfoMessageSpy.callCount).to.equal(1);
    expect(
      successInfoMessageSpy.calledWith(
        nls.localize(
          'force_lightning_lwc_mobile_android_start',
          rememberedAndroidDevice
        )
      )
    );
  });

  it('calls SFDX preview with remembered iOS device name', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);
    mockFileExists(mockLwcFilePath);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(true, true));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(iOSQuickPick);
    showInputBoxStub.resolves('');
    await forceLightningLwcPreview(mockLwcFilePathUri);
    mockExecution.processExitSubject.next(0);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members(['-p', 'iOS']);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-t',
      rememberediOSDevice
    ]);
    sinon.assert.calledOnce(mobileExecutorStub);
    expect(successInfoMessageSpy.callCount).to.equal(1);
    expect(
      successInfoMessageSpy.calledWith(
        nls.localize(
          'force_lightning_lwc_mobile_android_start',
          rememberediOSDevice
        )
      )
    );
  });

  it('shows warning when you cancel Android device name input', async () => {
    mockFileExists(mockLwcFilePath);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(true, true));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    // This simulates the user hitting the escape key to cancel input.
    showInputBoxStub.resolves(undefined);
    await forceLightningLwcPreview(mockLwcFilePathUri);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithArgSpy.callCount).to.equal(0);
    expect(cmdWithFlagSpy.callCount).to.equal(0);
    sinon.assert.notCalled(mobileExecutorStub);
    expect(
      showWarningMessageSpy.calledWith(
        nls.localize('force_lightning_lwc_android_device_cancelled')
      )
    );
  });

  it('shows warning when you cancel iOS device name input', async () => {
    mockFileExists(mockLwcFilePath);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(true, true));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(iOSQuickPick);
    // This simulates the user hitting the escape key to cancel input.
    showInputBoxStub.resolves(undefined);
    await forceLightningLwcPreview(mockLwcFilePathUri);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithArgSpy.callCount).to.equal(0);
    expect(cmdWithFlagSpy.callCount).to.equal(0);
    sinon.assert.notCalled(mobileExecutorStub);
    expect(
      showWarningMessageSpy.calledWith(
        nls.localize('force_lightning_lwc_ios_device_cancelled')
      )
    );
  });

  it('shows error in console when Android SFDX execution fails', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);
    mockFileExists(mockLwcFilePath);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(true, false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves('');
    await forceLightningLwcPreview(mockLwcFilePathUri);
    mockExecution.processExitSubject.next(1);

    sinon.assert.calledOnce(mobileExecutorStub);
    sinon.assert.calledTwice(showErrorMessageStub);
    sinon.assert.calledWith(
      showErrorMessageStub,
      sinon.match(
        nls.localize(
          'force_lightning_lwc_android_failure',
          androidQuickPick.defaultTargetName
        )
      )
    );
    sinon.assert.calledOnce(streamCommandOutputSpy);
    expect(successInfoMessageSpy.callCount).to.equal(0);
  });

  it('shows error in console when iOS SFDX execution fails', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);
    mockFileExists(mockLwcFilePath);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(true, false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(iOSQuickPick);
    showInputBoxStub.resolves('');
    await forceLightningLwcPreview(mockLwcFilePathUri);
    mockExecution.processExitSubject.next(1);

    sinon.assert.calledOnce(mobileExecutorStub);
    sinon.assert.calledTwice(showErrorMessageStub);
    sinon.assert.calledWith(
      showErrorMessageStub,
      sinon.match(
        nls.localize(
          'force_lightning_lwc_ios_failure',
          iOSQuickPick.defaultTargetName
        )
      )
    );
    sinon.assert.calledOnce(streamCommandOutputSpy);
    expect(successInfoMessageSpy.callCount).to.equal(0);
  });

  it('shows install message if sfdx plugin is not installed', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);
    mockFileExists(mockLwcFilePath);
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(true, false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves('');

    await forceLightningLwcPreview(mockLwcFilePathUri);
    mockExecution.processExitSubject.next(127);

    sinon.assert.calledOnce(mobileExecutorStub);
    sinon.assert.calledTwice(showErrorMessageStub);
    sinon.assert.calledWith(
      showErrorMessageStub,
      sinon.match(
        nls.localize(
          'force_lightning_lwc_android_failure',
          androidQuickPick.defaultTargetName
        )
      )
    );
    sinon.assert.calledOnce(streamCommandOutputSpy);
    expect(successInfoMessageSpy.callCount).to.equal(0);

    sinon.assert.calledTwice(appendLineSpy);
    expect(
      appendLineSpy.calledWith(
        nls.localize('force_lightning_lwc_mobile_no_plugin')
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

    getConfigurationStub.returns(new MockWorkspace(true, false, 'debug'));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves('');
    await forceLightningLwcPreview(mockLwcFilePathUri);
    mockExecution.stdoutSubject.next(androidSuccessString);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithArgSpy.callCount).to.equal(1);
    expect(cmdWithArgSpy.getCall(0).args[0]).equals(sfdxMobilePreviewCommand);
    expect(cmdWithFlagSpy.callCount).to.equal(4);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
      '-p',
      'Android'
    ]);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-t',
      'SFDXEmulator'
    ]);
    expect(cmdWithFlagSpy.getCall(2).args).to.have.same.members([
      '-n',
      'c/foo'
    ]);
    expect(cmdWithFlagSpy.getCall(3).args).to.have.same.members([
      '--loglevel',
      'debug'
    ]);
    sinon.assert.calledOnce(mobileExecutorStub);
    expect(successInfoMessageSpy.callCount).to.equal(1);
  });
});
