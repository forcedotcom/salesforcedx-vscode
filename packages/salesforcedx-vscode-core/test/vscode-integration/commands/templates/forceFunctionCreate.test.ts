/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as cp from 'child_process';
import * as path from 'path';
import { assert, createSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import {
  forceFunctionCreate,
  ForceFunctionCreateExecutor,
  FunctionInfoGatherer
} from '../../../../src/commands/templates/forceFunctionCreate';
import { SfdxWorkspaceChecker } from '../../../../src/commands/util/sfdxWorkspaceChecker';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { telemetryService } from '../../../../src/telemetry';
import { workspaceUtils } from '../../../../src/util';

import * as library from '@heroku/functions-core';
import * as sinon from 'sinon';

describe('Force Function Create', () => {
  let execStub: SinonStub;
  const sandbox = createSandbox();
  let notificationServiceStub: SinonStub;
  let telemetryServiceStub: SinonStub;
  let withProgressStub: SinonStub;
  let openTextDocumentStub: SinonStub;
  let showTextDocumentStub: SinonStub;
  let gatherStub: SinonStub;
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
  const workingDir = 'some/dir';
  beforeEach(() => {
    execStub = sandbox.stub(cp, 'exec');
    notificationServiceStub = sandbox.stub(
      notificationService,
      'showWarningMessage'
    );
    rootWorkspacePathStub = sandbox
      .stub(workspaceUtils, 'getRootWorkspacePath')
      .returns(workingDir);
    telemetryServiceStub = sandbox.stub(telemetryService, 'sendCommandEvent');
    withProgressStub = sandbox
      .stub(vscode.window, 'withProgress')
      .callsFake((options, task) => {
        task();
      });

    openTextDocumentStub = sandbox.stub(vscode.workspace, 'openTextDocument');
    openTextDocumentStub.resolves();

    showTextDocumentStub = sandbox.stub(vscode.window, 'showTextDocument');
    showTextDocumentStub.resolves();

    generateFunctionStub = sandbox.stub(library, 'generateFunction');
    generateFunctionStub.returns(
      Promise.resolve({
        path: path.join(workingDir, 'functions', 'myFunc1')
      })
    );

    gatherStub = sandbox.stub(FunctionInfoGatherer.prototype, 'gather');
    sandbox.stub(SfdxWorkspaceChecker.prototype, 'check').returns(true);
  });

  afterEach(() => {
    sandbox.restore();
  });
  describe('Generate function', () => {
    it('Should call generate function with proper args for javascript', async () => {
      const funcCreate = new ForceFunctionCreateExecutor();
      execStub.yields();
      await funcCreate.run(functionInfoJS);
      assert.calledOnce(generateFunctionStub);
      console.log('args', {
        generateARgs: JSON.stringify(generateFunctionStub.getCall(0).args)
      });
      assert.calledWith(
        generateFunctionStub,
        'myFunc1',
        'javascript',
        workingDir
      );
    });
    it('Should call generate function with proper args for java', async () => {
      const funcCreate = new ForceFunctionCreateExecutor();
      execStub.yields();
      await funcCreate.run(functionInfoJava);
      assert.calledOnce(generateFunctionStub);
      assert.calledWith(generateFunctionStub, 'myFunc1', 'java', workingDir);
    });
  });
  describe('Pull dependencies', () => {
    it('Should pull dependencies for javascript', async () => {
      execStub.yields();
      const funcCreate = new ForceFunctionCreateExecutor();
      await funcCreate.run(functionInfoJS);
      assert.calledOnce(execStub);
      assert.calledWith(execStub, 'npm install', {
        cwd: path.join(workingDir, 'functions', 'myFunc1')
      });
    });

    it('Should pull dependencies for java', async () => {
      execStub.yields();
      const funcCreate = new ForceFunctionCreateExecutor();
      await funcCreate.run(functionInfoJava);
      assert.calledOnce(execStub);
      /**
       * If this test fails, check if the Java Functions path strategy has changed.
       * Finding the root path for Java needs to be updated accordingly.
       */
      assert.calledWith(execStub, 'mvn install', {
        cwd: path.join(workingDir, 'functions', 'myFunc1')
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
        cwd: path.join(workingDir, 'functions', 'myFunc1')
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
        cwd: path.join(workingDir, 'functions', 'myFunc1')
      });
      assert.calledWith(
        notificationServiceStub,
        nls.localize('force_function_install_mvn_dependencies_error', errorText)
      );
    });
  });

  it('Should log additional language property when creating a java function', async () => {
    execStub.yields();
    gatherStub.resolves(functionInfoJava);
    await forceFunctionCreate();
    assert.calledOnce(telemetryServiceStub);
    assert.calledWith(
      telemetryServiceStub,
      'force_function_create',
      sinon.match.any,
      sinon.match.has('language', 'java'),
      sinon.match.any
    );
  });

  it('Should log additional language property when creating a js function', async () => {
    execStub.yields();
    gatherStub.resolves(functionInfoJS);
    await forceFunctionCreate();
    assert.calledOnce(telemetryServiceStub);
    assert.calledWith(
      telemetryServiceStub,
      'force_function_create',
      sinon.match.any,
      sinon.match.has('language', 'node'),
      sinon.match.any
    );
  });
});
