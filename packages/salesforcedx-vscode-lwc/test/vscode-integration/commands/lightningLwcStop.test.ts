/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { lightningLwcStop } from '../../../src/commands/lightningLwcStop';
import { DevServerService } from '../../../src/service/devServerService';
import { nls } from '../../../src/messages';
import {
  ChannelService,
  notificationService
} from '@salesforce/salesforcedx-utils-vscode';

describe('lightningLwcStop', () => {
  let sandbox: sinon.SinonSandbox;
  let devService: DevServerService;
  let appendLineStub: sinon.SinonStub;
  let notificationServiceStubs: {
    [key: string]: any;
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    devService = new DevServerService();
    sandbox.stub(DevServerService, 'instance').get(() => devService);

    notificationServiceStubs = {};

    appendLineStub = sandbox.stub(
      ChannelService.prototype,
      'appendLine' as any
    );
    notificationServiceStubs.showSuccessfulExecutionStub = sandbox
      .stub(notificationService, 'showSuccessfulExecution')
      .returns(Promise.resolve());
    notificationServiceStubs.showErrorMessageStub = sandbox.stub(
      notificationService,
      'showErrorMessage'
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('calls stopServer when a server is already running', async () => {
    const stopStub = sinon.stub();
    devService.registerServerHandler({
      stop: stopStub
    });

    await lightningLwcStop();
    sinon.assert.calledOnce(stopStub);
  });

  it('shows successful server stop', async () => {
    let devServiceStub = sinon.createStubInstance(DevServerService);
    devServiceStub.isServerHandlerRegistered.returns(true);
    sandbox.stub(DevServerService, 'instance').get(() => devServiceStub);

    await lightningLwcStop();

    sinon.assert.notCalled(notificationServiceStubs.showErrorMessageStub);

    sinon.assert.calledOnce(appendLineStub);
    sinon.assert.calledWith(
      appendLineStub,
      sinon.match(nls.localize('lightning_lwc_stop_in_progress'))
    );

    sinon.assert.calledOnce(
      notificationServiceStubs.showSuccessfulExecutionStub
    );
    sinon.assert.calledWith(
      notificationServiceStubs.showSuccessfulExecutionStub,
      sinon.match(nls.localize('lightning_lwc_stop_text'))
    );
  });
});
