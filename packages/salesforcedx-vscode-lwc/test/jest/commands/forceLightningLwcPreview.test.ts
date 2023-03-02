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
  notificationService,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode';
import { IsSfdxProjectOpened } from '@salesforce/salesforcedx-utils-vscode/out/src/commands/preconditionCheckers';
import { PredicateResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/predicates';
import {
  QuickPickItem,
  QuickPickOptions,
  window
} from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import URI from 'vscode-uri';
import { Subject } from 'rxjs/Subject';
import {
  DEV_SERVER_PREVIEW_ROUTE,
  DEV_SERVER_DEFAULT_BASE_URL
} from '../../../src/commands/commandConstants';
import * as commandUtils from '../../../src/commands/commandUtils';
import {
  forceLightningLwcPreview
} from '../../../src/commands/forceLightningLwcPreview';
import {
  ForceLightningLwcStartExecutor
} from '../../../src/commands/forceLightningLwcStart';
import {
  desktopPlatform,
  androidPlatform,
  iOSPlatform,
  OperationCancelledException,
  LWCPlatformQuickPickItem,
  LWCUtils
} from '../../../src/commands/lwcUtils';
import { PreviewService } from '../../../src/service/previewService';
import { nls } from '../../../src/messages';
import { DevServerService } from '../../../src/service/devServerService';

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

  let fakeExecutor: jest.SpyInstance<CliCommandExecution, any>
  let fakeExecution: any;
  let fakeBuilder: any;
  let showErrorFake: jest.SpyInstance<void, any>;
  let showSuccessfulExecutionFake: jest.SpyInstance<Promise<void>, any>
  let showInformationMessageFake: jest.Mock<any, any>;
  let getComponentPreviewUrlFake: jest.SpyInstance<string, any>;
  let executeSFDXCommandFake: jest.SpyInstance<void, any>;

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

    jest.spyOn(SfdxCommandBuilder.prototype, 'withDescription').mockReturnValue(fakeBuilder);
    jest.spyOn(SfdxCommandBuilder.prototype, 'withArg').mockReturnValue(fakeBuilder);
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

  describe('Resource Path Test', () => {
    it('exists sync called with correct path', async () => {
      const existsSyncFake = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'lstatSync').mockReturnValue({ isDirectory() { return false; } } as fs.Stats);
  
      // mock window.showQuickPick
      window.showQuickPick = 
        <T extends QuickPickItem>(
          items: readonly T[] | Thenable<readonly T[]>,
          options?: QuickPickOptions,
          token?: CancellationToken
        ): Thenable<T | undefined> => {
        return Promise.resolve(undefined);
      }
  
      await forceLightningLwcPreview(mockLwcFilePathUri);
  
      expect(existsSyncFake).toHaveBeenCalledWith(
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
  
    async function doPathTests(simulateFileExists: boolean, errorMessageLabel: string) {
      const notLwcModulePath = path.join(root, 'foo');
      const notLwcModulePathUri = URI.file(notLwcModulePath);
  
      const expectedErrorMessage = nls.localize(errorMessageLabel, /^win32/.test(process.platform) ? 'c:\\foo' : '/var/foo');
      showErrorFake = jest.spyOn(commandUtils, 'showError').mockImplementation(() => {});
      jest.spyOn(fs, 'existsSync').mockReturnValue(simulateFileExists);
      jest.spyOn(fs, 'lstatSync').mockReturnValue({ isDirectory() { return false; } } as fs.Stats);
  
      let err: Error | null = null;
      try {
        await forceLightningLwcPreview(notLwcModulePathUri);
      } catch (e) {
        err = e;
      }
  
      // verify that LWCUtils.showFailure() returns a rejected promise with correct error
      expect(err?.message).toBe(expectedErrorMessage);
  
      // verify that LWCUtils.showFailure() calls commandUtils.showError() with correct args
      expect(showErrorFake).toHaveBeenCalledWith(
        new Error(expectedErrorMessage),
        'force_lightning_lwc_preview',
        nls.localize('force_lightning_lwc_preview_text')
      );
    }
  });

  describe('Failure Scenarios', () => {
    it('shows an error message when open browser throws an error', async () => {
      showErrorFake = jest.spyOn(commandUtils, 'showError').mockImplementation(() => {});
  
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'lstatSync').mockReturnValue({ isDirectory() { return true; } } as fs.Stats);
  
      jest.spyOn(DevServerService.prototype, 'isServerHandlerRegistered').mockReturnValue(true);
      jest.spyOn(LWCUtils, 'selectPlatform').mockResolvedValue(desktopPlatform);
      jest.spyOn(commandUtils, 'openBrowser').mockRejectedValue(new Error('test error'));
  
      let err: Error | null = null;
      try {
        await forceLightningLwcPreview(mockLwcFileDirectoryUri);
      } catch (e) {
        err = e;
      }
  
      // verify that LWCUtils.showFailure() returns a rejected promise with correct error
      expect(err?.message).toBe('test error');
  
      // verify that LWCUtils.showFailure() calls commandUtils.showError() with correct args
      expect(showErrorFake).toHaveBeenCalledWith(
        new Error('test error'),
        'force_lightning_lwc_preview',
        nls.localize('force_lightning_lwc_preview_text')
      );
    });
  
    it('cancels command if user cancels providing input', async () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'lstatSync').mockReturnValue({ isDirectory() { return true; } } as fs.Stats);
  
      jest.spyOn(DevServerService.prototype, 'isServerHandlerRegistered').mockReturnValue(true);
  
      // mock window.showQuickPick
      window.showQuickPick = 
      <T extends QuickPickItem>(
        items: readonly T[] | Thenable<readonly T[]>,
        options?: QuickPickOptions,
        token?: CancellationToken
      ): Thenable<T | undefined> => {
        return Promise.resolve(undefined);
      }
  
      window.showWarningMessage = jest.fn();
  
      let err: Error | null = null;
      try {
        await forceLightningLwcPreview(mockLwcFileDirectoryUri);
      } catch (e) {
        err = e;
      }
  
      expect(err).toBeNull();
      expect(fakeExecutor).not.toHaveBeenCalled();
      expect(window.showWarningMessage).toHaveBeenCalledWith(new OperationCancelledException().message);
    });
  });

  describe('executeMobilePreview', () => {
    it('executeMobilePreview - success (url is directory)', async () => {
      await doExecuteMobilePreview(false, true);
    });
  
    it('executeMobilePreview - success (url is file)', async () => {
      await doExecuteMobilePreview(false, false);
    });
  
    it('executeMobilePreview - failure', async () => {
      await doExecuteMobilePreview(true, true);
    });
  
    async function doExecuteMobilePreview(isErrorCase: boolean, urlIsDirectory: boolean) {
      setupMobilePreviewCommand(iOSPlatform, urlIsDirectory, true, isErrorCase);
  
      await forceLightningLwcPreview(urlIsDirectory ? mockLwcFileDirectoryUri : mockLwcFilePathUri);
  
      expect(executeSFDXCommandFake).toHaveBeenCalled();
      expect(fakeBuilder.withFlag).toHaveBeenNthCalledWith(1, '-p', iOSPlatform.platformName);
      expect(fakeBuilder.withFlag).toHaveBeenNthCalledWith(2, '-t', 'testDeviceUDID');
      expect(fakeBuilder.withFlag).toHaveBeenNthCalledWith(3, '-n', 'c/foo');
      expect(fakeBuilder.withFlag).toHaveBeenNthCalledWith(4, '-a', 'com.example.app');
      expect(fakeBuilder.withFlag).toHaveBeenNthCalledWith(5, '-d', mockLwcFileDirectoryUri.fsPath);
      expect(fakeBuilder.withFlag).toHaveBeenNthCalledWith(6, '-f', path.join(mockLwcFileDirectoryUri.fsPath, 'mobile-apps.json'));
      expect(fakeBuilder.withFlag).toHaveBeenNthCalledWith(7, '--loglevel', 'warn');
  
      if (isErrorCase) {
        expect(showErrorFake).toHaveBeenCalled();
      } else {
        expect(showSuccessfulExecutionFake).toHaveBeenCalled();
        expect(showInformationMessageFake).toHaveBeenCalled();
      }
    }
  });

  describe('Preview in Browser', () => {
    it('starts the server if it is not running', async () => {
      setupMobilePreviewCommand(androidPlatform, false, false);
  
      jest.spyOn(IsSfdxProjectOpened.prototype, 'apply').mockReturnValue(PredicateResponse.true());
  
      const fake = jest.spyOn(ForceLightningLwcStartExecutor.prototype, 'execute').mockImplementation(() => {
        const instance = fake.mock.instances[0] as unknown as ForceLightningLwcStartExecutor;
        const onSuccess: () => void = instance['onSuccess'];
        onSuccess();
      });
  
      await forceLightningLwcPreview(mockLwcFilePathUri);
      expect(fake).toHaveBeenCalled();
    });
  
    it('calls openBrowser with the correct url for files', async () => {
      await doOpenBrowserTest(false);
    });
  
    it('calls openBrowser with the correct url for directories', async () => {
      await doOpenBrowserTest(true);
    });
  
    async function doOpenBrowserTest(urlIsDirectory: boolean) {
      const openBrowserFake = jest.spyOn(commandUtils, 'openBrowser').mockResolvedValue(true);
      setupMobilePreviewCommand(desktopPlatform, urlIsDirectory);
      await forceLightningLwcPreview(urlIsDirectory ? mockLwcFileDirectoryUri : mockLwcFilePathUri);
  
      expect(getComponentPreviewUrlFake).toHaveBeenCalledWith('c/foo');
      expect(openBrowserFake).toHaveBeenCalledWith(`${DEV_SERVER_DEFAULT_BASE_URL}/${DEV_SERVER_PREVIEW_ROUTE}/c/foo`);
    }
  });

  it('correct log level is used when the setting is changed', async () => {
    jest.spyOn(PreviewService.instance, 'getLogLevel').mockReturnValue('CustomLogLevel');

    setupMobilePreviewCommand(iOSPlatform, true);
    await forceLightningLwcPreview(mockLwcFileDirectoryUri);

    expect(executeSFDXCommandFake).toHaveBeenCalled();
    expect(fakeBuilder.withFlag).toHaveBeenNthCalledWith(1, '-p', iOSPlatform.platformName);
    expect(fakeBuilder.withFlag).toHaveBeenNthCalledWith(2, '-t', 'testDeviceUDID');
    expect(fakeBuilder.withFlag).toHaveBeenNthCalledWith(3, '-n', 'c/foo');
    expect(fakeBuilder.withFlag).toHaveBeenNthCalledWith(4, '-a', 'com.example.app');
    expect(fakeBuilder.withFlag).toHaveBeenNthCalledWith(5, '-d', mockLwcFileDirectoryUri.fsPath);
    expect(fakeBuilder.withFlag).toHaveBeenNthCalledWith(6, '-f', path.join(mockLwcFileDirectoryUri.fsPath, 'mobile-apps.json'));
    expect(fakeBuilder.withFlag).toHaveBeenNthCalledWith(7, '--loglevel', 'CustomLogLevel');
  });

  function setupMobilePreviewCommand(platform: LWCPlatformQuickPickItem, urlIsDirectory: boolean, devServerStarted: boolean = true, isErrorCase: boolean = false) {
    const previewUrl = `${DEV_SERVER_DEFAULT_BASE_URL}/${DEV_SERVER_PREVIEW_ROUTE}/c/foo`;
    jest.spyOn(DevServerService.prototype, 'isServerHandlerRegistered').mockReturnValue(devServerStarted);
    getComponentPreviewUrlFake = jest.spyOn(DevServerService.prototype, 'getComponentPreviewUrl').mockReturnValue(previewUrl);
    jest.spyOn(PreviewService.prototype, 'getLogLevel').mockReturnValue('warn');
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'lstatSync').mockReturnValue({ isDirectory() { return urlIsDirectory; } } as fs.Stats);
    jest.spyOn(LWCUtils, 'selectPlatform').mockResolvedValue(platform);
    jest.spyOn(LWCUtils, 'selectTargetDevice').mockResolvedValue('testDeviceUDID');
    jest.spyOn(LWCUtils, 'getAppOptionsFromPreviewConfigFile').mockReturnValue([ { label: 'My App', detail: 'com.example.app' } ]);
    jest.spyOn(LWCUtils, 'selectItem').mockImplementation((options) => Promise.resolve(options[options.length - 1]));
    
    showErrorFake = jest.spyOn(commandUtils, 'showError').mockImplementation(() => {});
    showSuccessfulExecutionFake = jest.spyOn(notificationService, 'showSuccessfulExecution').mockResolvedValue();
    showInformationMessageFake = jest.fn();
    window.showInformationMessage = showInformationMessageFake;

    executeSFDXCommandFake = jest.spyOn(LWCUtils, 'executeSFDXCommand').mockImplementation(
      (command, logName, startTime, monitorAndroidEmulatorProcess, onSuccess, onError) => {
        if (isErrorCase) {
          onError();
        } else {
          onSuccess();
        }
      }
    );
  }
});
