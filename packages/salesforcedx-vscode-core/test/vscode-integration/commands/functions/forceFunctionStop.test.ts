/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as library from '@heroku/functions-core';
import * as helpers from '@salesforce/salesforcedx-utils-vscode/out/src/helpers';
import * as path from 'path';
import { assert, createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { Uri } from 'vscode';
import { channelService } from '../../../../src/channels';
import { forceFunctionContainerStartCommand } from '../../../../src/commands/functions/forceFunctionContainerStartCommand';
import { forceFunctionStop } from '../../../../src/commands/functions/forceFunctionStop';
import { FunctionService } from '../../../../src/commands/functions/functionService';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { telemetryService } from '../../../../src/telemetry';
import { getRootWorkspacePath } from '../../../../src/util';

describe('Force Function Stop Integration Tests', () => {
  let sb: SinonSandbox;
  const functionsBinaryStub: {
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
    sb = createSandbox();
    functionsBinaryStub.cancel = sb.stub();
    sb.stub(library, 'getFunctionsBinary').returns(functionsBinaryStub);
    channelServiceStubs.appendLineStub = sb.stub(
      channelService,
      'appendLine'
    );
    notificationServiceStubs.showSuccessfulExecutionStub = sb.stub(
      notificationService,
      'showSuccessfulExecution'
    );
    notificationServiceStubs.showSuccessfulExecutionStub.returns(
      Promise.resolve()
    );
    notificationServiceStubs.showWarningMessageStub = sb.stub(
      notificationService,
      'showWarningMessage'
    );
    telemetryServiceStubs.sendCommandEventStub = sb.stub(
      telemetryService,
      'sendCommandEvent'
    );
    hrtimeStub = sb.stub(process, 'hrtime');
  });

  afterEach(() => {
    sb.restore();
  });

  it('Should stop function, show notification and send telemetry', async () => {
    const FUNCTION_LANGUAGE = 'node';
    functionServiceStubs.getFunctionLanguage = sb.stub(
      FunctionService.prototype,
      'getFunctionLanguage'
    );
    functionServiceStubs.getFunctionLanguage.returns(FUNCTION_LANGUAGE);
    const srcUri = Uri.file(
      path.join(getRootWorkspacePath(), 'functions', 'demoJavaScriptFunction')
    );

    sb.stub(helpers, 'flushFilePath')
      .returns(srcUri.path);

    await forceFunctionContainerStartCommand(srcUri);

    const mockStartTime = [1234, 5678];
    hrtimeStub.returns(mockStartTime);
    await forceFunctionStop();

    assert.calledOnce(functionsBinaryStub.cancel);
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
    assert.calledOnce(telemetryServiceStubs.sendCommandEventStub);
    assert.calledWith(
      telemetryServiceStubs.sendCommandEventStub,
      'force_function_stop',
      mockStartTime,
      { language: FUNCTION_LANGUAGE }
    );
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
      path.join(getRootWorkspacePath(), 'functions', 'demoJavaScriptFunction')
    );

    sb.stub(helpers, 'flushFilePath')
      .returns(srcUri.path);

    await forceFunctionContainerStartCommand(srcUri);

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
