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
import { DEV_SERVER_PREVIEW_ROUTE } from '../../../src/commands/commandConstants';
import * as commandUtils from '../../../src/commands/commandUtils';
import { forceLightningLwcPreview } from '../../../src/commands/forceLightningLwcPreview';
import { DevServerService } from '../../../src/service/devServerService';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const { SfdxCommandlet } = sfdxCoreExports;

describe('forceLightningLwcPreview', () => {
  let sandbox: SinonSandbox;
  let devServiceStub: any;
  let openBrowserStub: SinonStub;
  let existsSyncStub: sinon.SinonStub;
  let lstatSyncStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    devServiceStub = sinon.createStubInstance(DevServerService);
    sandbox.stub(DevServerService, 'instance').get(() => devServiceStub);
    openBrowserStub = sandbox.stub(commandUtils, 'openBrowser');
    existsSyncStub = sandbox.stub(fs, 'existsSync');
    lstatSyncStub = sandbox.stub(fs, 'lstatSync');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('calls openBrowser with the correct url for files', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);

    const testPath = path.join(
      'dev',
      'project',
      'force-app',
      'main',
      'default',
      'lwc',
      'foo',
      'foo.js'
    );
    const sourceUri = { path: testPath } as vscode.Uri;

    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    });

    await forceLightningLwcPreview(sourceUri);

    sinon.assert.calledOnce(openBrowserStub);
    sinon.assert.calledWith(
      openBrowserStub,
      sinon.match(`${DEV_SERVER_PREVIEW_ROUTE}/c/foo`)
    );
  });

  it('calls openBrowser with the correct url for directories', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);

    const testPath = path.join(
      'dev',
      'project',
      'force-app',
      'main',
      'default',
      'lwc',
      'foo'
    );
    const sourceUri = { path: testPath } as vscode.Uri;

    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    });

    await forceLightningLwcPreview(sourceUri);

    sinon.assert.calledOnce(openBrowserStub);
    sinon.assert.calledWith(
      openBrowserStub,
      sinon.match(`${DEV_SERVER_PREVIEW_ROUTE}/c/foo`)
    );
  });

  it('starts the server if it is not running yet', async () => {
    devServiceStub.isServerHandlerRegistered.returns(false);

    const testPath = path.join(
      'dev',
      'project',
      'force-app',
      'main',
      'default',
      'lwc',
      'foo'
    );
    const sourceUri = { path: testPath } as vscode.Uri;

    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    });

    const commandletStub = sandbox.stub(SfdxCommandlet.prototype, 'run');
    await forceLightningLwcPreview(sourceUri);

    sinon.assert.calledOnce(commandletStub);
  });
});
