/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ChannelService,
  Command,
  SfdxCommandBuilder,
  SfdxCommandlet,
  notificationService
} from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import URI from 'vscode-uri';
import {
  DEV_SERVER_PREVIEW_ROUTE,
  DEV_SERVER_DEFAULT_BASE_URL
} from '../../../src/commands/commandConstants';
import * as commandUtils from '../../../src/commands/commandUtils';
import {
  forceLightningLwcPreview
} from '../../../src/commands/forceLightningLwcPreview';
import {
  desktopPlatform,
  androidPlatform,
  OperationCancelledException,
  LWCPlatformQuickPickItem,
  LWCUtils
} from '../../../src/commands/lwcUtils';
import { nls } from '../../../src/messages';
import { DevServerService } from '../../../src/service/devServerService';
import { WorkspaceUtils } from '../../../src/util/workspaceUtils';

describe('forceLightningLwcPreview', () => {
  const sfdxMobilePreviewCommand = 'force:lightning:lwc:preview';

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

  let sandbox: sinon.SinonSandbox;
  let commands: Command[];
  let showErrorStub: sinon.SinonStub<[e: Error, logName: string, commandName: string], void>;
  let showInformationMessageStub: sinon.SinonStub<[message: string, options: vscode.MessageOptions, ...items: vscode.MessageItem[]], Thenable<vscode.MessageItem | undefined>>;
  let showSuccessfulExecutionStub: sinon.SinonStub<[executionName: string, channelService: ChannelService | undefined], Promise<void>>;
  let devServiceStub: sinon.SinonStubbedInstance<DevServerService>

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    commands = [];
  });

  afterEach(() => {
    sinon.restore();
    sandbox.restore();
  });

  it('exists sync called with correct path', async () => {
    const existsSyncStub = sandbox.stub(fs, 'existsSync');
    existsSyncStub.returns(true);

    const lstatSyncStub = sandbox.stub(fs, 'lstatSync');
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    const showQuickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
    showQuickPickStub.resolves(undefined);

    await forceLightningLwcPreview(mockLwcFilePathUri);

    sinon.assert.called(existsSyncStub);
    sinon.assert.calledWith(
      existsSyncStub,
      /^win32/.test(process.platform)
        ? 'c:\\project\\force-app\\main\\default\\lwc\\foo\\foo.js'
        : '/var/project/force-app/main/default/lwc/foo/foo.js'
    );
  });

  it('shows an error when source path is not recognized as an lwc module file', async () => {
    await doPathTests(false, 'force_lightning_lwc_file_nonexist');
  });

  it('shows an error when source path does not exist', async () => {
    await doPathTests(true, 'force_lightning_lwc_unsupported');
  });

  it('shows an error message when open browser throws an error', async () => {
    const showErrorSpy = sandbox.spy(commandUtils, 'showError');

    const existsSyncStub = sandbox.stub(fs, 'existsSync');
    existsSyncStub.returns(true);

    const lstatSyncStub = sandbox.stub(fs, 'lstatSync');
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    devServiceStub = sinon.createStubInstance(DevServerService);
    devServiceStub.isServerHandlerRegistered.returns(true);

    sandbox.stub(DevServerService, 'instance').get(() => devServiceStub);

    sandbox.stub(LWCUtils, 'selectPlatform').resolves(desktopPlatform);

    const openBrowserStub = sandbox.stub(commandUtils, 'openBrowser');
    openBrowserStub.rejects(new Error('test error'));

    let err: Error | null = null;
    try {
      await forceLightningLwcPreview(mockLwcFileDirectoryUri);
    } catch (e) {
      err = e;
    }

    expect(err?.message).to.be.equal('test error');

    expect(showErrorSpy.callCount).to.equal(1);
    expect(showErrorSpy.getCall(0).args[0].message).equals('test error');
    expect(showErrorSpy.getCall(0).args[1]).equals('force_lightning_lwc_preview');
    expect(showErrorSpy.getCall(0).args[2]).equals(nls.localize('force_lightning_lwc_preview_text'));
  });

  it('cancels command if user cancels providing input', async () => {
    const existsSyncStub = sandbox.stub(fs, 'existsSync');
    existsSyncStub.returns(true);

    const lstatSyncStub = sandbox.stub(fs, 'lstatSync');
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    devServiceStub = sinon.createStubInstance(DevServerService);
    devServiceStub.isServerHandlerRegistered.returns(true);

    sandbox.stub(DevServerService, 'instance').get(() => devServiceStub);

    const showQuickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
    showQuickPickStub.resolves(undefined);

    const cmdWithArgSpy = sandbox.spy(SfdxCommandBuilder.prototype, 'withArg');
    const cmdWithFlagSpy = sandbox.spy(SfdxCommandBuilder.prototype, 'withFlag');
    const showWarningMessageSpy = sandbox.spy(vscode.window, 'showWarningMessage');

    let err: Error | null = null;
    try {
      await forceLightningLwcPreview(mockLwcFileDirectoryUri);
    } catch (e) {
      err = e;
    }

    expect(err).to.be.equal(null);

    sinon.assert.notCalled(cmdWithArgSpy);
    sinon.assert.notCalled(cmdWithFlagSpy);
    expect(
      showWarningMessageSpy.calledWith(new OperationCancelledException().message)
    );
  });

  it('executeMobilePreview - success (url is directory)', async () => {
    await doExecuteMobilePreview(false, true);
  });

  it('executeMobilePreview - success (url is file)', async () => {
    await doExecuteMobilePreview(false, false);
  });

  it('executeMobilePreview - failure', async () => {
    await doExecuteMobilePreview(true, true);
  });

  it('starts the server if it is not running', async () => {
    setupMobilePreviewCommand(androidPlatform, false, false);
    const commandletStub = sandbox.stub(SfdxCommandlet.prototype, 'run');
    await forceLightningLwcPreview(mockLwcFilePathUri);
    sinon.assert.calledOnce(commandletStub);
  });

  it('calls openBrowser with the correct url for files', async () => {
    await doOpenBrowserTest(false);
  });

  it('calls openBrowser with the correct url for directories', async () => {
    await doOpenBrowserTest(true);
  });

  it('correct log level is used when the setting is changed', async () => {
    const getConfigurationStub = sandbox.stub(WorkspaceUtils.prototype, 'getWorkspaceSettings');
    const config: vscode.WorkspaceConfiguration = {
      get: function(section: string): string | undefined { return 'CustomLogLevel'; },
      has: function (section: string): boolean { return true; },
      inspect: function <T>(section: string): { key: string; defaultValue?: T | undefined; globalValue?: T | undefined; workspaceValue?: T | undefined; workspaceFolderValue?: T | undefined; defaultLanguageValue?: T | undefined; globalLanguageValue?: T | undefined; workspaceLanguageValue?: T | undefined; workspaceFolderLanguageValue?: T | undefined; languageIds?: string[] | undefined; } | undefined {
        return undefined;
      },
      update: function (section: string, value: any, configurationTarget?: boolean | vscode.ConfigurationTarget | null | undefined, overrideInLanguage?: boolean | undefined): Thenable<void> {
        return Promise.resolve();
      }
    }
    getConfigurationStub.returns(config);

    setupMobilePreviewCommand(iosPlatform, true);
    await forceLightningLwcPreview(mockLwcFileDirectoryUri);

    expect(commands.length).to.be.equal(1);
    expect(commands[0].args).to.have.same.members([
      sfdxMobilePreviewCommand,
      '-p',
      iosPlatform.platformName,
      '-t',
      'testDeviceUDID',
      '-n',
      'c/foo',
      '-a',
      'com.example.app',
      '-d',
      mockLwcFileDirectoryUri.fsPath,
      '-f',
      path.join(mockLwcFileDirectoryUri.fsPath, 'mobile-apps.json'),
      '--loglevel',
      'CustomLogLevel'
    ]);
  });

  async function doPathTests(simulateFileExists: boolean, errorMessageLabel: string) {
    const notLwcModulePath = path.join(root, 'foo');
    const notLwcModulePathUri = URI.file(notLwcModulePath);

    const expectedErrorMessage = nls.localize(errorMessageLabel, /^win32/.test(process.platform) ? 'c:\\foo' : '/var/foo');
    const showErrorSpy = sandbox.spy(commandUtils, 'showError');
    const existsSyncStub = sandbox.stub(fs, 'existsSync');
    existsSyncStub.returns(simulateFileExists);

    const lstatSyncStub = sandbox.stub(fs, 'lstatSync');
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    let err: Error | null = null;
    try {
      await forceLightningLwcPreview(notLwcModulePathUri);
    } catch (e) {
      err = e;
    }

    expect(err?.message).to.be.equal(expectedErrorMessage);

    expect(showErrorSpy.callCount).to.equal(1);
    expect(showErrorSpy.getCall(0).args[0].message).equals(expectedErrorMessage);
    expect(showErrorSpy.getCall(0).args[1]).equals('force_lightning_lwc_preview');
    expect(showErrorSpy.getCall(0).args[2]).equals(nls.localize('force_lightning_lwc_preview_text'));
  }

  async function doExecuteMobilePreview(isErrorCase: boolean, urlIsDirectory: boolean) {
    setupMobilePreviewCommand(iosPlatform, urlIsDirectory, true, isErrorCase);

    let err: Error | null = null;
    try {
      await forceLightningLwcPreview(urlIsDirectory ? mockLwcFileDirectoryUri : mockLwcFilePathUri);
    } catch (e) {
      err = e;
    }
    
    expect(commands.length).to.be.equal(1);
    expect(commands[0].args).to.have.same.members([
      sfdxMobilePreviewCommand,
      '-p',
      iosPlatform.platformName,
      '-t',
      'testDeviceUDID',
      '-n',
      'c/foo',
      '-a',
      'com.example.app',
      '-d',
      mockLwcFileDirectoryUri.fsPath,
      '-f',
      path.join(mockLwcFileDirectoryUri.fsPath, 'mobile-apps.json'),
      '--loglevel',
      'warn'
    ]);

    if (isErrorCase) {
      expect(err).not.to.be.equal(null);
      expect(showErrorStub).to.have.been.called;
    } else {
      expect(err).to.be.equal(null);
      expect(showSuccessfulExecutionStub).to.have.been.called;
      expect(showInformationMessageStub).to.have.been.called;
    }
  }

  function setupMobilePreviewCommand(platform: LWCPlatformQuickPickItem, urlIsDirectory: boolean, devServerStarted: boolean = true, isErrorCase: boolean = false) {
    devServiceStub = sinon.createStubInstance(DevServerService);
    devServiceStub.isServerHandlerRegistered.returns(devServerStarted);
    sandbox.stub(DevServerService, 'instance').get(() => devServiceStub);

    sandbox.stub(fs, 'existsSync').returns(true);
    sandbox.stub(fs, 'lstatSync').returns({ isDirectory() { return urlIsDirectory; } } as fs.Stats);

    const previewUrl = `${DEV_SERVER_DEFAULT_BASE_URL}/${DEV_SERVER_PREVIEW_ROUTE}/c/foo`;
    devServiceStub.getComponentPreviewUrl.returns(previewUrl);

    sandbox.stub(LWCUtils, 'selectPlatform').callsFake(() => Promise.resolve(platform));
    sandbox.stub(LWCUtils, 'selectTargetDevice').callsFake(() => Promise.resolve('testDeviceUDID'));
    sandbox.stub(LWCUtils, 'getAppOptionsFromPreviewConfigFile').callsFake(() => [ { label: 'My App', detail: 'com.example.app' } ]);
    sandbox.stub(LWCUtils, 'selectItem').callsFake((options) => Promise.resolve(options[options.length - 1]));

    showErrorStub = sandbox.stub(commandUtils, 'showError');
    showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');
    showSuccessfulExecutionStub = sandbox.stub(notificationService, 'showSuccessfulExecution');
    showSuccessfulExecutionStub.returns(Promise.resolve());

    sandbox.stub(LWCUtils, 'executeSFDXCommand').callsFake((command, logName, startTime, monitorAndroidEmulatorProcess, onSuccess, onError) => { 
      commands.push(command);
      if (isErrorCase) {
        onError();
      } else {
        onSuccess();
      }
    });
  }

  async function doOpenBrowserTest(urlIsDirectory: boolean) {
    const openBrowserStub = sandbox.stub(commandUtils, 'openBrowser');
    setupMobilePreviewCommand(desktopPlatform, urlIsDirectory);
    await forceLightningLwcPreview(urlIsDirectory ? mockLwcFileDirectoryUri : mockLwcFilePathUri);

    sinon.assert.calledWith(
      devServiceStub.getComponentPreviewUrl,
      sinon.match('c/foo')
    );
    sinon.assert.calledOnce(openBrowserStub);
    sinon.assert.calledWith(
      openBrowserStub,
      sinon.match(`${DEV_SERVER_DEFAULT_BASE_URL}/${DEV_SERVER_PREVIEW_ROUTE}/c/foo`)
    );
  }
});
