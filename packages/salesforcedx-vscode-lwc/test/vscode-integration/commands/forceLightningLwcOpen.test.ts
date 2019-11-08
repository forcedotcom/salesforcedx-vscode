/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { DEV_SERVER_BASE_URL } from '../../../src/commands/commandConstants';
import * as commandUtils from '../../../src/commands/commandUtils';
import { forceLightningLwcOpen } from '../../../src/commands/forceLightningLwcOpen';
import { DevServerService } from '../../../src/service/devServerService';

describe('forceLightningLwcOpen', () => {
  let sandbox: SinonSandbox;
  let devServiceStub: any;
  let openBrowserStub: SinonStub;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    devServiceStub = sinon.createStubInstance(DevServerService);
    sandbox.stub(DevServerService, 'instance').get(() => devServiceStub);
    openBrowserStub = sandbox.stub(commandUtils, 'openBrowser');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('calls openBrowser when a server is already running', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);

    await forceLightningLwcOpen();

    sinon.assert.calledOnce(openBrowserStub);
    sinon.assert.calledWith(openBrowserStub, sinon.match(DEV_SERVER_BASE_URL));
  });

  it('starts the server if it is not running yet', async () => {
    devServiceStub.isServerHandlerRegistered.returns(false);

    const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');

    await forceLightningLwcOpen();

    sinon.assert.calledOnce(executeCommandStub);
    sinon.assert.calledWith(
      executeCommandStub,
      'sfdx.force.lightning.lwc.start'
    );
  });
});
