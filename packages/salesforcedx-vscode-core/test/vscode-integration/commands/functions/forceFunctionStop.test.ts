/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { assert, createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { Uri } from 'vscode';

import * as library from '@heroku/functions-core';
import {
    channelService, notificationService, workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';

import {
    forceFunctionContainerlessStartCommand
} from '../../../../src/commands/functions/forceFunctionContainerlessStartCommand';
import { forceFunctionStop } from '../../../../src/commands/functions/forceFunctionStop';
import { FunctionService } from '../../../../src/commands/functions/functionService';
import { nls } from '../../../../src/messages';
import { telemetryService } from '../../../../src/telemetry';

describe('Force Function Stop Integration Tests', () => {
  let sandbox: SinonSandbox;
  const functionsProcessInstStub: {
    [key: string]: SinonStub;
  } = {};
  const channelServiceStubs: {
    [key: string]: SinonStub;
  } = {};
  const notificationServiceStubs: {
    [key: string]: SinonStub;
  } = {};
  const telemetryServiceStubs: {
    [key: string]: SinonStub;
  } = {};
  const functionServiceStubs: {
    [key: string]: SinonStub;
  } = {};
  let hrtimeStub: SinonStub;

  beforeEach(() => {
    sandbox = createSandbox();
    functionsProcessInstStub.cancel = sandbox.stub();
    sandbox
      .stub(library.LocalRun.prototype, 'exec')
      .resolves(functionsProcessInstStub);
    channelServiceStubs.appendLineStub = sandbox.stub(
      channelService,
      'appendLine'
    );
    notificationServiceStubs.showSuccessfulExecutionStub = sandbox.stub(
      notificationService,
      'showSuccessfulExecution'
    );
    notificationServiceStubs.showSuccessfulExecutionStub.returns(
      Promise.resolve()
    );
    notificationServiceStubs.showWarningMessageStub = sandbox.stub(
      notificationService,
      'showWarningMessage'
    );
    telemetryServiceStubs.sendCommandEventStub = sandbox.stub(
      telemetryService,
      'sendCommandEvent'
    );
    hrtimeStub = sandbox.stub(process, 'hrtime');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('Should stop function, show notification and send telemetry', async () => {
    const FUNCTION_LANGUAGE = 'node';
    functionServiceStubs.getFunctionLanguage = sandbox.stub(
      FunctionService.prototype,
      'getFunctionLanguage'
    );
    functionServiceStubs.getFunctionLanguage.returns(FUNCTION_LANGUAGE);
    const srcUri = Uri.file(
      path.join(
        workspaceUtils.getRootWorkspacePath(),
        'functions',
        'demoJavaScriptFunction'
      )
    );

    await forceFunctionContainerlessStartCommand(srcUri);

    const mockStartTime = [1234, 5678];
    hrtimeStub.returns(mockStartTime);
    await forceFunctionStop();

    assert.calledOnce(functionsProcessInstStub.cancel);
    assert.called(channelServiceStubs.appendLineStub);
    assert.calledWith(
      channelServiceStubs.appendLineStub,
      nls.localize('force_function_stop_in_progress')
    );
    assert.calledOnce(notificationServiceStubs.showSuccessfulExecutionStub);
    assert.calledWith(
      notificationServiceStubs.showSuccessfulExecutionStub,
      nls.localize('force_function_stop_text')
    );
    assert.calledTwice(telemetryServiceStubs.sendCommandEventStub);
  });

  it('Should show warning message if function is not started', async () => {
    await forceFunctionStop();

    assert.calledOnce(notificationServiceStubs.showWarningMessageStub);
    assert.calledWith(
      notificationServiceStubs.showWarningMessageStub,
      nls.localize('force_function_stop_not_started')
    );
  });

  it('Should show warning message if already stopped function', async () => {
    const srcUri = Uri.file(
      path.join(
        workspaceUtils.getRootWorkspacePath(),
        'functions',
        'demoJavaScriptFunction'
      )
    );

    await forceFunctionContainerlessStartCommand(srcUri);

    const mockStartTime = [1234, 5678];
    hrtimeStub.returns(mockStartTime);
    await forceFunctionStop();
    await forceFunctionStop();

    assert.calledOnce(notificationServiceStubs.showWarningMessageStub);
    assert.calledWith(
      notificationServiceStubs.showWarningMessageStub,
      nls.localize('force_function_stop_not_started')
    );
  });
});
