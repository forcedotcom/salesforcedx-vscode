/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LibraryCommandletExecutor } from '@salesforce/salesforcedx-utils-vscode/out/src';

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

describe('Force Function Invoke', () => {
  it('Should return a type of boolean', async () => {
    const invokeFunc = new ForceFunctionInvoke();
    const payloadUri = '/some/path/payload.json';
    const funcInvokeCmd = await invokeFunc.run({type:"CONTINUE", data: payloadUri});

    expect(funcInvokeCmd).to.be.an('boolean');
  });

  describe('Debug Invoke', () => {
    let sandbox: SinonSandbox;
    let libraryCommandExecutorStub: SinonStub;
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
      libraryCommandExecutorStub = sandbox.stub(
        LibraryCommandletExecutor.prototype,
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
      libraryCommandExecutorStub.returns(executor.run({type:"CONTINUE", data: srcUri.fsPath}));
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
    //   const mockExecution = new MockExecution(executor.build(srcUri.fsPath));
      libraryCommandExecutorStub.returns(executor.run({type:"CONTINUE", data: srcUri.fsPath}));
      await forceFunctionDebugInvoke(srcUri);

      assert.notCalled(libraryCommandExecutorStub);
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
      libraryCommandExecutorStub.returns(executor.run({type:"CONTINUE", data: srcUri.fsPath}));
      await forceFunctionDebugInvoke(srcUri);

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
