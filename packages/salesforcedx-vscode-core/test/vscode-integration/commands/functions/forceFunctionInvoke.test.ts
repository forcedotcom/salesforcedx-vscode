/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CliCommandExecutor } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { assert, createSandbox, match, SinonSandbox, SinonStub } from 'sinon';
import { Uri } from 'vscode';
import {
  forceFunctionDebugInvoke,
  ForceFunctionInvoke
} from '../../../../src/commands/functions/forceFunctionInvoke';
import { FunctionService } from '../../../../src/commands/functions/functionService';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { telemetryService } from '../../../../src/telemetry';
import { getRootWorkspacePath } from '../../../../src/util';
import { MockExecution } from './mockExecution';

describe('Force Function Invoke', () => {
  it('Should build invoke command', async () => {
    const invokeFunc = new ForceFunctionInvoke();
    const payloadUri = '/some/path/payload.json';
    const funcInvokeCmd = invokeFunc.build(payloadUri);

    expect(funcInvokeCmd.toCommand()).to.equal(
      `sfdx evergreen:function:invoke http://localhost:8080 --payload @${payloadUri}`
    );
    expect(funcInvokeCmd.description).to.equal(
      nls.localize('force_function_invoke_text')
    );
  });

  describe('Debug Invoke', () => {
    let sandbox: SinonSandbox;
    let cliCommandExecutorStub: SinonStub;
    const notificationServiceStubs: {
      [key: string]: SinonStub;
    } = {};
    const telemetryServiceStubs: {
      [key: string]: SinonStub;
    } = {};
    const functionServiceStubs: {
      [key: string]: SinonStub;
    } = {};
    beforeEach(() => {
      sandbox = createSandbox();
      cliCommandExecutorStub = sandbox.stub(
        CliCommandExecutor.prototype,
        'execute'
      );
      notificationServiceStubs.showWarningMessageStub = sandbox.stub(
        notificationService,
        'showWarningMessage'
      );
      telemetryServiceStubs.sendCommandEventStub = sandbox.stub(
        telemetryService,
        'sendCommandEvent'
      );
      telemetryServiceStubs.sendExceptionStub = sandbox.stub(
        telemetryService,
        'sendException'
      );
      functionServiceStubs.debugFunctionStub = sandbox.stub(
        FunctionService.prototype,
        'debugFunction'
      );
      functionServiceStubs.stopDebuggingFunctionStub = sandbox.stub(
        FunctionService.prototype,
        'stopDebuggingFunction'
      );
    });
    afterEach(() => {
      sandbox.restore();
    });

    it('Should start a debug session and attach to debug port', async () => {
      const srcUri = Uri.file(
        path.join(
          getRootWorkspacePath(),
          'functions/demoJavaScriptFunction/payload.json'
        )
      );
      const rootDir = path.join(
        getRootWorkspacePath(),
        'functions/demoJavaScriptFunction'
      );
      const executor = new ForceFunctionInvoke();
      const mockExecution = new MockExecution(executor.build(srcUri.fsPath));
      cliCommandExecutorStub.returns(mockExecution);

      await forceFunctionDebugInvoke(srcUri);

      assert.calledOnce(functionServiceStubs.debugFunctionStub);
      assert.calledWith(functionServiceStubs.debugFunctionStub, rootDir);
    });

    it('Should show warning and log telemetry if debugged function does not have toml', async () => {
      const srcUri = Uri.file(
        path.join(
          getRootWorkspacePath(),
          'functions/demoJavaScriptFunction/payload.json'
        )
      );
      const existsSyncStub = sandbox.stub(fs, 'existsSync');
      existsSyncStub.returns(false);
      const executor = new ForceFunctionInvoke();
      const mockExecution = new MockExecution(executor.build(srcUri.fsPath));
      cliCommandExecutorStub.returns(mockExecution);

      await forceFunctionDebugInvoke(srcUri);

      assert.notCalled(cliCommandExecutorStub);
      assert.calledOnce(notificationServiceStubs.showWarningMessageStub);
      assert.calledWith(
        notificationServiceStubs.showWarningMessageStub,
        nls.localize('force_function_start_warning_no_toml')
      );
      assert.calledOnce(telemetryServiceStubs.sendExceptionStub);
      assert.calledWith(
        telemetryServiceStubs.sendExceptionStub,
        'force_function_debug_invoke_no_toml',
        nls.localize('force_function_start_warning_no_toml')
      );
    });

    it('Should stop debugging and log telemetry when invoke finishes', async () => {
      const srcUri = Uri.file(
        path.join(
          getRootWorkspacePath(),
          'functions/demoJavaScriptFunction/payload.json'
        )
      );
      const executor = new ForceFunctionInvoke();
      const mockExecution = new MockExecution(executor.build(srcUri.fsPath));
      cliCommandExecutorStub.returns(mockExecution);
      await forceFunctionDebugInvoke(srcUri);
      mockExecution.processExitSubject.next(0);

      return new Promise(resolve => {
        process.nextTick(() => {
          assert.calledOnce(functionServiceStubs.stopDebuggingFunctionStub);
          assert.calledTwice(telemetryServiceStubs.sendCommandEventStub);
          assert.calledWith(
            telemetryServiceStubs.sendCommandEventStub,
            'force_function_invoke',
            match.array
          );
          assert.calledWith(
            telemetryServiceStubs.sendCommandEventStub,
            'force_function_debug_invoke',
            match.array
          );
          resolve();
        });
      });
    });
  });
});
