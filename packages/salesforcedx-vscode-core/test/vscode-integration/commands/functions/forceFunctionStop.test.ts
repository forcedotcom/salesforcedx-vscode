/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CliCommandExecutor } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as path from 'path';
import { assert, createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { Uri } from 'vscode';
import { channelService } from '../../../../src/channels';
import {
  forceFunctionStart,
  ForceFunctionStartExecutor
} from '../../../../src/commands/functions/forceFunctionStart';
import { forceFunctionStop } from '../../../../src/commands/functions/forceFunctionStop';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { telemetryService } from '../../../../src/telemetry';
import { getRootWorkspacePath } from '../../../../src/util';
import { MockExecution } from './mockExecution';

describe('Force Function Stop', () => {
  let sandbox: SinonSandbox;
  let cliCommandExecutorStub: SinonStub;
  const channelServiceStubs: {
    [key: string]: SinonStub;
  } = {};
  const notificationServiceStubs: {
    [key: string]: SinonStub;
  } = {};
  const telemetryServiceStubs: {
    [key: string]: SinonStub;
  } = {};
  let hrtimeStub: SinonStub;
  beforeEach(() => {
    sandbox = createSandbox();

    cliCommandExecutorStub = sandbox.stub(
      CliCommandExecutor.prototype,
      'execute'
    );
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
    const srcUri = Uri.file(
      path.join(getRootWorkspacePath(), 'functions', 'demoJavaScriptFunction')
    );
    const executor = new ForceFunctionStartExecutor();
    const mockExecution = new MockExecution(executor.build(srcUri.fsPath));
    const killExecutionStub = sandbox.stub(mockExecution, 'killExecution');
    cliCommandExecutorStub.returns(mockExecution);
    await forceFunctionStart(srcUri);

    const mockStartTime = [1234, 5678];
    hrtimeStub.returns(mockStartTime);
    await forceFunctionStop();

    assert.calledOnce(killExecutionStub);
    assert.calledOnce(channelServiceStubs.appendLineStub);
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
      mockStartTime
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
    const executor = new ForceFunctionStartExecutor();
    const mockExecution = new MockExecution(executor.build(srcUri.fsPath));
    cliCommandExecutorStub.returns(mockExecution);
    await forceFunctionStart(srcUri);

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
