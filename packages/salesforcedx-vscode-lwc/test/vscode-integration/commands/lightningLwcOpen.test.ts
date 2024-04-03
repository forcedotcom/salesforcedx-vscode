/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { DEV_SERVER_DEFAULT_BASE_URL } from '../../../src/commands/commandConstants';
import * as commandUtils from '../../../src/commands/commandUtils';
import { lightningLwcOpen } from '../../../src/commands/lightningLwcOpen';
import { DevServerService } from '../../../src/service/devServerService';

describe('lightningLwcOpen', () => {
  let sandbox: SinonSandbox;
  let devServiceStub: any;
  let openBrowserStub: SinonStub<[string], Thenable<boolean>>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    devServiceStub = sinon.createStubInstance(DevServerService);
    sandbox.stub(DevServerService, 'instance').get(() => devServiceStub);
    openBrowserStub = sandbox.stub(commandUtils, 'openBrowser');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('calls openBrowser when a server is already running', async () => {
    devServiceStub.isServerHandlerRegistered.returns(true);
    devServiceStub.getBaseUrl.returns(DEV_SERVER_DEFAULT_BASE_URL);

    await lightningLwcOpen();

    sinon.assert.calledOnce(openBrowserStub);
    sinon.assert.calledWith(
      openBrowserStub,
      sinon.match(DEV_SERVER_DEFAULT_BASE_URL)
    );
  });

  it('starts the server if it is not running yet', async () => {
    devServiceStub.isServerHandlerRegistered.returns(false);

    const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');

    await lightningLwcOpen();

    sinon.assert.calledOnce(executeCommandStub);
    sinon.assert.calledWith(executeCommandStub, 'sf.lightning.lwc.start');
  });
});
