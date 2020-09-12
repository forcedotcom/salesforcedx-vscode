/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  CommandExecution
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import * as path from 'path';
import { Subject } from 'rxjs/Subject';
import { assert, createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { Uri } from 'vscode';
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
import { getRootWorkspacePath } from '../../../../src/util';

class MockExecution implements CommandExecution {
  public command: Command;
  public processExitSubject: Subject<number>;
  public processErrorSubject: Subject<Error>;
  public stdoutSubject: Subject<string>;
  public stderrSubject: Subject<string>;
  private readonly childProcessPid: any;

  constructor(command: Command) {
    this.command = command;
    this.processExitSubject = new Subject<number>();
    this.processErrorSubject = new Subject<Error>();
    this.stdoutSubject = new Subject<string>();
    this.stderrSubject = new Subject<string>();
    this.childProcessPid = '';
  }

  public killExecution(signal?: string): Promise<void> {
    return Promise.resolve();
  }
}

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
    let logMetricStub: SinonStub;
    let hrtimeStub: SinonStub;
    beforeEach(() => {
      sandbox = createSandbox();

      cliCommandExecutorStub = sandbox.stub(
        CliCommandExecutor.prototype,
        'execute'
      );
      channelServiceStubs.streamCommandOutputWithoutColorStub = sandbox.stub(
        channelService,
        'streamCommandOutputWithoutColor'
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
      notificationServiceStubs.reportCommandExecutionStatus = sandbox.stub(
        notificationService,
        'reportCommandExecutionStatus'
      );
      notificationServiceStubs.progressNotificationShowStub = sandbox.stub(
        ProgressNotification,
        'show'
      );
      logMetricStub = sandbox.stub(
        ForceFunctionStartExecutor.prototype,
        'logMetric'
      );
      hrtimeStub = sandbox.stub(process, 'hrtime');
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('Should start function', async () => {
      const srcUri = Uri.file(
        path.join(getRootWorkspacePath(), 'functions', 'demoJavaScriptFunction')
      );
      const executor = new ForceFunctionStartExecutor();
      const mockExecution = new MockExecution(executor.build(srcUri.fsPath));
      cliCommandExecutorStub.returns(mockExecution);

      await forceFunctionStart(srcUri);

      assert.calledOnce(cliCommandExecutorStub);
    });

    it('Should stream output to channel', async () => {
      const srcUri = Uri.file(
        path.join(getRootWorkspacePath(), 'functions', 'demoJavaScriptFunction')
      );
      const executor = new ForceFunctionStartExecutor();
      const mockExecution = new MockExecution(executor.build(srcUri.fsPath));
      cliCommandExecutorStub.returns(mockExecution);

      await forceFunctionStart(srcUri);

      assert.calledOnce(
        channelServiceStubs.streamCommandOutputWithoutColorStub
      );
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
