/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as cp from 'child_process';
import * as path from 'path';
import { assert, createSandbox, SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { ForceFunctionCreateExecutor } from '../../../../src/commands/templates/forceFunctionCreate';
import {
  FUNCTION_TYPE_JAVA,
  FUNCTION_TYPE_JS
} from '../../../../src/commands/templates/metadataTypeConstants';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { telemetryService } from '../../../../src/telemetry';
import * as rootWorkspace from '../../../../src/util';

import * as library from '@heroku/functions-core';
// tslint:disable:no-unused-expression
describe('Force Function Create', () => {
  let execStub: SinonStub;
  const sandbox = createSandbox();
  let notificationServiceStub: SinonStub;
  let telemetryServiceStub: SinonStub;
  let withProgressStub: SinonStub;
  let openTextDocumentStub: SinonStub;
  let showTextDocumentStub: SinonStub;
  const functionInfoJS = {
    type: 'CONTINUE' as 'CONTINUE',
    data: {
      fileName: 'myFunc1',
      language: 'javascript'
    }
  };
  const functionInfoJava = {
    type: 'CONTINUE' as 'CONTINUE',
    data: {
      fileName: 'myFunc1',
      language: 'java'
    }
  };
  let rootWorkspacePathStub: SinonStub;
  let generateFunctionStub: SinonStub;
  beforeEach(() => {
    execStub = sandbox.stub(cp, 'exec');
    notificationServiceStub = sandbox.stub(
      notificationService,
      'showWarningMessage'
    );
    rootWorkspacePathStub = sandbox.stub(rootWorkspace, 'getRootWorkspacePath');
    rootWorkspacePathStub.returns('some/dir');
    telemetryServiceStub = sandbox.stub(telemetryService, 'sendCommandEvent');
    withProgressStub = sandbox.stub(vscode.window, 'withProgress');
    withProgressStub.callsFake((options, task) => {
      task();
    });

    openTextDocumentStub = sandbox.stub(vscode.workspace, 'openTextDocument');
    openTextDocumentStub.resolves({ uri: '123' });

    showTextDocumentStub = sandbox.stub(vscode.window, 'showTextDocument');
    showTextDocumentStub.resolves(null);

    generateFunctionStub = sandbox.stub(library, 'generateFunction');
    generateFunctionStub.returns(
      Promise.resolve({
        path: path.join('some', 'dir', 'functions', 'myFunc1')
      })
    );
  });

  afterEach(() => {
    sandbox.restore();
  });
  describe('Generate function', () => {
    it('Should call generate function with proper args for javascript', async () => {
      const funcCreate = new ForceFunctionCreateExecutor();
      try {
        await funcCreate.run(functionInfoJS);
      } catch {}
      assert.calledOnce(generateFunctionStub);
      assert.calledWith(
        generateFunctionStub,
        'myFunc1',
        'javascript',
        path.join('some', 'dir', 'functions', 'myFunc1')
      );
    });
  });
  describe('Pull dependencies', () => {
    it('Should pull dependencies for javascript', async () => {
      const funcCreate = new ForceFunctionCreateExecutor();
      try {
        await funcCreate.run(functionInfoJS);
      } catch {}
      assert.calledOnce(execStub);
      assert.calledWith(execStub, 'npm install', {
        cwd: path.join('some', 'dir', 'functions', 'myFunc1')
      });
    });

    it('Should pull dependencies for java', async () => {
      const funcCreate = new ForceFunctionCreateExecutor();
      try {
        await funcCreate.run(functionInfoJava);
      } catch {}
      assert.calledOnce(execStub);
      /**
       * If this test fails, check if the Java Functions path strategy has changed.
       * Finding the root path for Java in runPostCommandTasks needs to be updated accordingly.
       */
      assert.calledWith(execStub, 'mvn install', {
        cwd: path.join('some', 'dir', 'functions', 'myFunc1')
      });
    });

    it('Should call notification service when errored for javascript', async () => {
      const funcCreate = new ForceFunctionCreateExecutor();
      const errorText = 'custom error text';
      execStub.yields(new Error(errorText));
      try {
        await funcCreate.run(functionInfoJS);
      } catch {}
      assert.calledOnce(execStub);
      assert.calledWith(execStub, 'npm install', {
        cwd: path.join('some', 'dir', 'functions', 'myFunc1')
      });
      assert.calledWith(
        notificationServiceStub,
        nls.localize('force_function_install_npm_dependencies_error', errorText)
      );
    });

    it('Should call notification service when errored for java', async () => {
      const funcCreate = new ForceFunctionCreateExecutor();
      const errorText = 'custom error text';
      execStub.yields(new Error(errorText));
      try {
        await funcCreate.run(functionInfoJava);
      } catch {}
      assert.calledOnce(execStub);
      assert.calledWith(execStub, 'mvn install', {
        cwd: path.join('some', 'dir', 'functions', 'myFunc1')
      });
      assert.calledWith(
        notificationServiceStub,
        nls.localize('force_function_install_mvn_dependencies_error', errorText)
      );
    });
  });

  // it('Should log additional language property when creating a java function', async () => {
  //   const funcCreate = new ForceFunctionCreateExecutor();
  //   funcCreate.metadata = FUNCTION_TYPE_JAVA;
  //   funcCreate.build(functionInfoJava);
  //   funcCreate.logMetric('log_java', [1234, 5678], {});
  //   assert.calledOnce(telemetryServiceStub);
  //   expect(telemetryServiceStub.firstCall.args).to.deep.equal([
  //     'log_java',
  //     [1234, 5678],
  //     { language: 'java' },
  //     undefined
  //   ]);
  // });

  // it('Should log additional language property when creating a js function', async () => {
  //   const funcCreate = new ForceFunctionCreateExecutor();
  //   funcCreate.metadata = FUNCTION_TYPE_JS;
  //   funcCreate.build(functionInfoJS);
  //   funcCreate.logMetric('log_javascript', [1234, 5678], {});
  //   assert.calledOnce(telemetryServiceStub);
  //   expect(telemetryServiceStub.firstCall.args).to.deep.equal([
  //     'log_javascript',
  //     [1234, 5678],
  //     { language: 'node' },
  //     undefined
  //   ]);
  // });
});
