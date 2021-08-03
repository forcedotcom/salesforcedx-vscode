/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { runFunction } from '@heroku/functions-core';

import * as fs from 'fs';
import { run } from 'mocha';
import * as path from 'path';
import {
  assert,
  createSandbox,
  match,
  SinonSandbox,
  SinonSpy,
  SinonStub
} from 'sinon';
import { Uri } from 'vscode';
import {
  forceFunctionDebugInvoke,
  forceFunctionInvoke,
  ForceFunctionInvoke
} from '../../../../src/commands/functions/forceFunctionInvoke';
import { FunctionService } from '../../../../src/commands/functions/functionService';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { telemetryService } from '../../../../src/telemetry';
import { getRootWorkspacePath, OrgAuthInfo } from '../../../../src/util';

import * as library from '@heroku/functions-core';

const demoPayload = {
  id: 2345,
  service: 'MyService'
};

describe('Force Function Invoke', () => {
  let sandbox: SinonSandbox;
  let runFunctionLibraryStub: SinonStub;
  let functionInvokeSpy: SinonSpy;
  const notificationServiceStubs: {
    [key: string]: SinonStub;
  } = {};
  const telemetryServiceStubs: {
    [key: string]: SinonStub;
  } = {};
  const functionServiceStubs: {
    [key: string]: SinonStub;
  } = {};
  let readFileSyncStub: SinonStub;
  beforeEach(() => {
    sandbox = createSandbox();
    runFunctionLibraryStub = sandbox.stub(library, 'runFunction');
    runFunctionLibraryStub.returns(Promise.resolve(true));
    functionInvokeSpy = sandbox.spy(ForceFunctionInvoke.prototype, 'run');
    readFileSyncStub = sandbox.stub(fs, 'readFileSync');
    readFileSyncStub.returns(demoPayload);
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
  describe('Debug Invoke', () => {
    it('Should call library with proper args and log telemetry', async () => {
      const srcUri = Uri.file(
        path.join(
          getRootWorkspacePath(),
          'functions/demoJavaScriptFunction/payload.json'
        )
      );
      await forceFunctionDebugInvoke(srcUri);
      const defaultUsername = await OrgAuthInfo.getDefaultUsernameOrAlias(
        false
      );

      assert.calledOnce(runFunctionLibraryStub);
      assert.calledWith(runFunctionLibraryStub, {
        url: 'http://localhost:8080',
        payload: demoPayload,
        targetusername: defaultUsername
      });
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
      await forceFunctionDebugInvoke(srcUri);

      assert.notCalled(functionInvokeSpy);
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
      const FUNCTION_LANGUAGE = 'node';
      functionServiceStubs.getFunctionLanguage = sandbox.stub(
        FunctionService.prototype,
        'getFunctionLanguage'
      );
      functionServiceStubs.getFunctionLanguage.returns(FUNCTION_LANGUAGE);
      const srcUri = Uri.file(
        path.join(
          getRootWorkspacePath(),
          'functions/demoJavaScriptFunction/payload.json'
        )
      );

      await forceFunctionDebugInvoke(srcUri);

      return new Promise(resolve => {
        process.nextTick(() => {
          assert.calledOnce(functionServiceStubs.stopDebuggingFunctionStub);
          assert.calledOnce(telemetryServiceStubs.sendCommandEventStub);
          assert.calledWith(
            telemetryServiceStubs.sendCommandEventStub,
            'force_function_debug_invoke',
            match.array,
            { language: FUNCTION_LANGUAGE, success: 'true' }
          );
          resolve();
        });
      });
    });
  });
  describe('Regular Invoke', () => {
    it('Should call library with proper args and log telemetry', async () => {
      const FUNCTION_LANGUAGE = 'node';
      functionServiceStubs.getFunctionLanguage = sandbox.stub(
        FunctionService.prototype,
        'getFunctionLanguage'
      );
      functionServiceStubs.getFunctionLanguage.returns(FUNCTION_LANGUAGE);

      const srcUri = Uri.file(
        path.join(
          getRootWorkspacePath(),
          'functions/demoJavaScriptFunction/payload.json'
        )
      );
      await forceFunctionInvoke(srcUri);
      const defaultUsername = await OrgAuthInfo.getDefaultUsernameOrAlias(
        false
      );

      assert.calledOnce(runFunctionLibraryStub);
      assert.calledWith(runFunctionLibraryStub, {
        url: 'http://localhost:8080',
        payload: demoPayload,
        targetusername: defaultUsername
      });

      assert.calledOnce(telemetryServiceStubs.sendCommandEventStub);
      assert.calledWith(
        telemetryServiceStubs.sendCommandEventStub,
        'force_function_invoke',
        match.array,
        { language: FUNCTION_LANGUAGE, success: 'true' }
      );
    });
  });
});
