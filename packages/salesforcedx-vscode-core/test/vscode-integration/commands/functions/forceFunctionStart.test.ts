/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CliCommandExecutor } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import * as path from 'path';
import { assert, createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { Uri, window } from 'vscode';
import { channelService } from '../../../../src/channels';
import {
  forceFunctionStart,
  ForceFunctionStartExecutor
} from '../../../../src/commands/functions/forceFunctionStart';
import { nls } from '../../../../src/messages';
import {
  notificationService,
  ProgressNotification
} from '../../../../src/notifications';
import { taskViewService } from '../../../../src/statuses';
import { telemetryService } from '../../../../src/telemetry';
import { getRootWorkspacePath } from '../../../../src/util';
import { MockExecution } from './mockExecution';

describe('Force Function Start', () => {
  describe('build', () => {
    it('returns a command with the correct params', () => {
      const executor = new ForceFunctionStartExecutor();
      const command = executor.build('');
      expect(command.toCommand()).to.equal(
        `sfdx evergreen:function:start --verbose`
      );
    });

    it('returns a command with the correct description', () => {
      const executor = new ForceFunctionStartExecutor();
      const command = executor.build('');
      expect(command.description).to.equal(
        nls.localize('force_function_start_text')
      );
    });

    it('returns a command with the correct logName', () => {
      const executor = new ForceFunctionStartExecutor();
      const command = executor.build('');
      expect(command.logName).to.equal('force_function_start');
    });
  });

  describe('execute', () => {
    let sandbox: SinonSandbox;
    let cliCommandExecutorStub: SinonStub;
    const channelServiceStubs: {
      [key: string]: SinonStub;
    } = {};
    const taskViewServiceStubs: {
      [key: string]: SinonStub;
    } = {};
    const notificationServiceStubs: {
      [key: string]: SinonStub;
    } = {};
    const telemetryServiceStubs: {
      [key: string]: SinonStub;
    } = {};
    let activeTextEditorStub: SinonStub;
    let logMetricStub: SinonStub;
    let hrtimeStub: SinonStub;
    beforeEach(() => {
      sandbox = createSandbox();

      cliCommandExecutorStub = sandbox.stub(
        CliCommandExecutor.prototype,
        'execute'
      );
      channelServiceStubs.streamCommandOutputStub = sandbox.stub(
        channelService,
        'streamCommandOutput'
      );
      channelServiceStubs.showChannelOutputStub = sandbox.stub(
        channelService,
        'showChannelOutput'
      );
      taskViewServiceStubs.addCommandExecutionStub = sandbox.stub(
        taskViewService,
        'addCommandExecution'
      );
      taskViewServiceStubs.removeTaskStub = sandbox.stub(
        taskViewService,
        'removeTask'
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
      notificationServiceStubs.reportCommandExecutionStatus = sandbox.stub(
        notificationService,
        'reportCommandExecutionStatus'
      );
      notificationServiceStubs.progressNotificationShowStub = sandbox.stub(
        ProgressNotification,
        'show'
      );
      telemetryServiceStubs.sendExceptionStub = sandbox.stub(
        telemetryService,
        'sendException'
      );
      activeTextEditorStub = sandbox.stub(window, 'activeTextEditor');
      logMetricStub = sandbox.stub(
        ForceFunctionStartExecutor.prototype,
        'logMetric'
      );
      hrtimeStub = sandbox.stub(process, 'hrtime');
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('Should start function from folder', async () => {
      const srcUri = Uri.file(
        path.join(getRootWorkspacePath(), 'functions', 'demoJavaScriptFunction')
      );
      const executor = new ForceFunctionStartExecutor();
      const mockExecution = new MockExecution(executor.build(srcUri.fsPath));
      cliCommandExecutorStub.returns(mockExecution);

      await forceFunctionStart(srcUri);

      assert.calledOnce(cliCommandExecutorStub);
    });

    it('Should start function from file', async () => {
      const srcUri = Uri.file(
        path.join(
          getRootWorkspacePath(),
          'functions',
          'demoJavaScriptFunction',
          'index.js'
        )
      );
      const executor = new ForceFunctionStartExecutor();
      const mockExecution = new MockExecution(executor.build(srcUri.fsPath));
      cliCommandExecutorStub.returns(mockExecution);

      await forceFunctionStart(srcUri);

      assert.calledOnce(cliCommandExecutorStub);
    });

    it('Should start function from active text editor if sourceUri not specified', async () => {
      const srcUri = Uri.file(
        path.join(
          getRootWorkspacePath(),
          'functions',
          'demoJavaScriptFunction',
          'index.js'
        )
      );
      activeTextEditorStub.get(() => {
        return {
          document: {
            uri: srcUri,
            languageId: 'javascript'
          }
        };
      });

      const executor = new ForceFunctionStartExecutor();
      const mockExecution = new MockExecution(executor.build(srcUri.fsPath));
      cliCommandExecutorStub.returns(mockExecution);

      await forceFunctionStart();

      assert.calledOnce(cliCommandExecutorStub);
    });

    it('Should show warning and log telemetry if sourceUri not specified and not actively editing a function file', async () => {
      const srcUri = Uri.file(
        path.join(
          getRootWorkspacePath(),
          'functions',
          'demoJavaScriptFunction',
          'index.js'
        )
      );
      activeTextEditorStub.get(() => {
        return {
          document: {
            uri: undefined,
            languageId: 'javascript'
          }
        };
      });

      const executor = new ForceFunctionStartExecutor();
      const mockExecution = new MockExecution(executor.build(srcUri.fsPath));
      cliCommandExecutorStub.returns(mockExecution);

      await forceFunctionStart();

      assert.notCalled(cliCommandExecutorStub);
      assert.calledOnce(notificationServiceStubs.showWarningMessageStub);
      assert.calledWith(
        notificationServiceStubs.showWarningMessageStub,
        nls.localize('force_function_start_warning_not_in_function_folder')
      );
      assert.calledOnce(telemetryServiceStubs.sendExceptionStub);
      assert.calledWith(
        telemetryServiceStubs.sendExceptionStub,
        'force_function_start',
        'force_function_start_not_in_function_folder'
      );
    });

    it('Should show warning and log telemetry if start function from a non-function folder', async () => {
      const srcUri = Uri.file(
        path.join(getRootWorkspacePath(), 'force-app/main/default/lwc')
      );
      const executor = new ForceFunctionStartExecutor();
      const mockExecution = new MockExecution(executor.build(srcUri.fsPath));
      cliCommandExecutorStub.returns(mockExecution);

      await forceFunctionStart(srcUri);

      assert.notCalled(cliCommandExecutorStub);
      assert.calledOnce(notificationServiceStubs.showWarningMessageStub);
      assert.calledWith(
        notificationServiceStubs.showWarningMessageStub,
        nls.localize('force_function_start_warning_no_toml')
      );
      assert.calledOnce(telemetryServiceStubs.sendExceptionStub);
      assert.calledWith(
        telemetryServiceStubs.sendExceptionStub,
        'force_function_start',
        'force_function_start_no_toml'
      );
    });

    it('Should stream output to channel', async () => {
      const srcUri = Uri.file(
        path.join(getRootWorkspacePath(), 'functions', 'demoJavaScriptFunction')
      );
      const executor = new ForceFunctionStartExecutor();
      const mockExecution = new MockExecution(executor.build(srcUri.fsPath));
      cliCommandExecutorStub.returns(mockExecution);

      await forceFunctionStart(srcUri);

      assert.calledOnce(channelServiceStubs.streamCommandOutputStub);
      assert.calledOnce(channelServiceStubs.showChannelOutputStub);
    });

    it('Should log telemetry on successful execution', async () => {
      const srcUri = Uri.file(
        path.join(getRootWorkspacePath(), 'functions', 'demoJavaScriptFunction')
      );
      const executor = new ForceFunctionStartExecutor();
      const mockExecution = new MockExecution(executor.build(srcUri.fsPath));
      const mockStartTime = [1234, 5678];
      cliCommandExecutorStub.returns(mockExecution);
      hrtimeStub.returns(mockStartTime);

      await forceFunctionStart(srcUri);

      mockExecution.stdoutSubject.next('Ready to process signals');
      assert.calledOnce(logMetricStub);
      assert.calledWith(logMetricStub, 'force_function_start', mockStartTime);
    });
  });
});
