/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CancellationToken,
  QuickPickItem,
  QuickPickOptions,
  window
} from 'vscode';
import { Command, notificationService } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
import * as path from 'path';
import URI from 'vscode-uri';
import {
  forceLightningLwcTestUIMobileRun
} from '../../../src/commands/forceLightningLwcTestUIMobileRun';
import {
  androidPlatform,
  OperationCancelledException,
  LWCUtils
} from '../../../src/commands/lwcUtils';
import { nls } from '../../../src/messages';

jest.mock('../../../src/channel');

describe('forceLightningLwcTestUIMobileRun', () => {
  const sfdxMobileUTAMRunCommand = 'force:lightning:lwc:test:ui:mobile:run';
  const sfdxMobileConfigCommand = 'force:lightning:lwc:test:ui:mobile:configure';

  const root = /^win32/.test(process.platform) ? 'c:\\' : '/var';
  const mockLwcFileDirectory = path.join(
    root,
    'project',
    'force-app',
    'main',
    'default',
    'lwc',
    'foo',
    '__tests__'
  );
  const mockLwcFileDirectoryUri = URI.file(mockLwcFileDirectory);
  const mockLwcFilePath = path.join(mockLwcFileDirectory, 'foo.test.js');
  const mockLwcFilePathUri = URI.file(mockLwcFilePath);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('cancels command if user cancels providing input', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'lstatSync').mockReturnValue({ isDirectory() { return true; } } as fs.Stats);

    const executeSFDXCommandFake = jest.spyOn(LWCUtils, 'executeSFDXCommand');

    const showWarningMessageFake = jest.fn();
    window.showWarningMessage = showWarningMessageFake;

    // mock window.showQuickPick
    window.showQuickPick = 
      <T extends QuickPickItem>(
        items: readonly T[] | Thenable<readonly T[]>,
        options?: QuickPickOptions,
        token?: CancellationToken
      ): Thenable<T | undefined> => {
      return Promise.resolve(undefined);
    }

    await forceLightningLwcTestUIMobileRun(mockLwcFileDirectoryUri);

    expect(executeSFDXCommandFake).not.toHaveBeenCalled();
    expect(showWarningMessageFake).toHaveBeenCalledWith(new OperationCancelledException().message);
  });

  it('runUTAMTest - Success (browse for existing WDIO config)', async () => {
    const configFile = '/path/to/wdio.conf.js';
    
    let commands: Command[] = [];

    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'lstatSync').mockReturnValue({ isDirectory() { return false; } } as fs.Stats);

    jest.spyOn(LWCUtils, 'selectItem').mockResolvedValue({ label: 'Browse' });

    jest.spyOn(LWCUtils, 'executeSFDXCommand').mockImplementation(
      (command, logName, startTime, monitorAndroidEmulatorProcess, onSuccess, onError) => { 
        commands.push(command);
        onSuccess();
      }
    );

    const showOpenDialogMock = jest.fn(() => Promise.resolve([URI.file(configFile)]));
    window.showOpenDialog = showOpenDialogMock;

    const showInformationMessageFake = jest.fn();
    window.showInformationMessage = showInformationMessageFake;

    const showSuccessfulExecutionFake = jest.spyOn(notificationService, 'showSuccessfulExecution').mockResolvedValue();
    
    await forceLightningLwcTestUIMobileRun(mockLwcFilePathUri);

    expect(commands.length).toBe(1);

    expect(commands[0].args).toEqual([
      sfdxMobileUTAMRunCommand,
      '--config',
      path.normalize(configFile),
      '--spec',
      mockLwcFilePathUri.fsPath
    ]);

    expect(showSuccessfulExecutionFake).toHaveBeenCalled();
    expect(showInformationMessageFake).toHaveBeenCalled();
  });

  it('runUTAMTest - Success (create new WDIO config)', async () => {
    const configFile = '/path/to/wdio.conf.js';
    const appBundle = '/path/to/my.apk';

    let commands: Command[] = [];

    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'lstatSync').mockReturnValue({ isDirectory() { return false; } } as fs.Stats);

    jest.spyOn(LWCUtils, 'selectPlatform').mockResolvedValue(androidPlatform);
    jest.spyOn(LWCUtils, 'selectTargetDevice').mockResolvedValue('Pixel_5_API_31');
    jest.spyOn(LWCUtils, 'getUserInput').mockResolvedValue('');

    jest.spyOn(LWCUtils, 'executeSFDXCommand').mockImplementation(
      (command, logName, startTime, monitorAndroidEmulatorProcess, onSuccess, onError) => { 
        commands.push(command);
        onSuccess();
      }
    );

    // return the first item in the list
    jest.spyOn(LWCUtils, 'selectItem').mockImplementation((items) => Promise.resolve(items[0]));

    jest.spyOn(LWCUtils, 'getFilePath').mockImplementation((title) => {
      if (title === nls.localize('force_lightning_lwc_test_wdio_output_config_file_title')) {
        return Promise.resolve(configFile);
      } else if (title === nls.localize('force_lightning_lwc_app_bundle')) {
        return Promise.resolve(appBundle);
      } else {
        return Promise.resolve('');
      }
    });

    const showInformationMessageFake = jest.fn();
    window.showInformationMessage = showInformationMessageFake;

    const showSuccessfulExecutionFake = jest.spyOn(notificationService, 'showSuccessfulExecution').mockResolvedValue();

    await forceLightningLwcTestUIMobileRun(mockLwcFilePathUri);

    expect(commands.length).toBe(2); // UTAM Create Config + UTAM Run

    expect(commands[0].args).toEqual([
      sfdxMobileConfigCommand,
      '-p',
      'Android',
      '-d',
      'Pixel_5_API_31',
      '--bundlepath',
      appBundle,
      '--output',
      configFile,
      '--testframework',
      'jasmine',
      '--injectionconfigs',
      'salesforce-pageobjects/utam-salesforceapp-pageobjects.config.json',
      '--appactivity',
      'com.salesforce.chatter.Chatter',
      '--apppackage',
      'com.salesforce.chatter'
    ]);

    expect(commands[1].args).toEqual([
      sfdxMobileUTAMRunCommand,
      '--config',
      configFile,
      '--spec',
      mockLwcFilePathUri.fsPath
    ]);

    expect(showSuccessfulExecutionFake).toHaveBeenCalled();
    expect(showInformationMessageFake).toHaveBeenCalled();
  });
});
