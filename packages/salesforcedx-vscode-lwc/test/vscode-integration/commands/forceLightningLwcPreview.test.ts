/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import URI from 'vscode-uri';
import { DEV_SERVER_PREVIEW_ROUTE } from '../../../src/commands/commandConstants';
import * as commandUtils from '../../../src/commands/commandUtils';
import { forceLightningLwcPreview } from '../../../src/commands/forceLightningLwcPreview';
import { nls } from '../../../src/messages';
import { DevServerService } from '../../../src/service/devServerService';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const { SfdxCommandlet, notificationService } = sfdxCoreExports;

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
  const mockLwcFilePath = path.join(mockLwcFileDirectory, 'foo.js');

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
  });

  afterEach(() => {
    sandbox.restore();
  });

  function mockFileExists(mockPath: string) {
    existsSyncStub.callsFake(fsPath => {
      if (path.normalize(fsPath.toString()) === path.normalize(mockPath)) {
        return true;
      } else {
        return false;
      }
    });
  }

  it('calls openBrowser with the correct url for files', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);
    const sourceUri = URI.file(mockLwcFilePath);
    mockFileExists(mockLwcFilePath);

    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    await forceLightningLwcPreview(sourceUri);

    sinon.assert.calledOnce(openBrowserStub);
    sinon.assert.calledWith(
      openBrowserStub,
      sinon.match(`${DEV_SERVER_PREVIEW_ROUTE}/c/foo`)
    );
  });

  it('calls openBrowser with the correct url for directories', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);
    const sourceUri = URI.file(mockLwcFileDirectory);
    mockFileExists(mockLwcFileDirectory);

    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    await forceLightningLwcPreview(sourceUri);

    sinon.assert.calledOnce(openBrowserStub);
    sinon.assert.calledWith(
      openBrowserStub,
      sinon.match(`${DEV_SERVER_PREVIEW_ROUTE}/c/foo`)
    );
  });

  it('starts the server if it is not running yet', async () => {
    devServiceStub.isServerHandlerRegistered.returns(false);

    const sourceUri = URI.file(mockLwcFilePath);
    mockFileExists(mockLwcFilePath);

    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    const commandletStub = sandbox.stub(SfdxCommandlet.prototype, 'run');
    await forceLightningLwcPreview(sourceUri);

    sinon.assert.calledOnce(commandletStub);
  });

  it('shows an error when source path is not recognized as an lwc module file', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);

    const notLwcModulePath = path.join('/foo');
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
        nls.localize(`force_lightning_lwc_preview_unsupported`, '/foo')
      )
    );
  });

  it('shows an error when source path does not exist', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);

    const nonExistentPath = path.join('/foo');
    const sourceUri = URI.file(nonExistentPath);

    existsSyncStub.returns(false);

    await forceLightningLwcPreview(sourceUri);

    sinon.assert.calledWith(
      showErrorMessageStub,
      sinon.match(
        nls.localize(`force_lightning_lwc_preview_file_nonexist`, '/foo')
      )
    );
  });

  it('shows an error message when open browser throws an error', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);

    const sourceUri = URI.file(mockLwcFilePath);
    mockFileExists(mockLwcFilePath);

    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    openBrowserStub.throws('test error');

    await forceLightningLwcPreview(sourceUri);

    const commandName = nls.localize(`force_lightning_lwc_preview_text`);
    sinon.assert.calledTwice(showErrorMessageStub);
    sinon.assert.calledWith(
      showErrorMessageStub,
      sinon.match(nls.localize('command_failure', commandName))
    );
  });
});
