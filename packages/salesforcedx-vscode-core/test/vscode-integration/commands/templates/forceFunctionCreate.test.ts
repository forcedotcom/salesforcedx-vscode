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
import { FUNCTION_TYPE_JAVA, FUNCTION_TYPE_JS } from '../../../../src/commands/templates/metadataTypeConstants';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { telemetryService } from '../../../../src/telemetry';
import * as rootWorkspace from '../../../../src/util';

// tslint:disable:no-unused-expression
describe('Force Function Create', () => {
  describe('Creation', () => {
    it('Should build apex function create command for javascript', async () => {
      const funcCreate = new ForceFunctionCreateExecutor();
      const fileName = 'myFunc1';
      const funcCreateCmd = funcCreate.build({
        fileName,
        language: 'javascript',
        outputdir: ''
      });

      expect(funcCreateCmd.toCommand()).to.equal(
        'sfdx generate:function --name myFunc1 --language javascript'
      );
      expect(funcCreateCmd.description).to.equal(
        nls.localize('force_function_create_text')
      );
      expect(funcCreate.getFileExtension()).to.equal('.js');
    });

    it('Should build apex function create command for java', async () => {
      const funcCreate = new ForceFunctionCreateExecutor();
      const fileName = 'myFunc2';
      const funcCreateCmd = funcCreate.build({
        fileName,
        language: 'java',
        outputdir: ''
      });

      expect(funcCreateCmd.toCommand()).to.equal(
        'sfdx generate:function --name myFunc2 --language java'
      );
      expect(funcCreateCmd.description).to.equal(
        nls.localize('force_function_create_text')
      );
      expect(funcCreate.getFileExtension()).to.equal('.java');
    });
  });

  describe('Pull Dependencies', () => {
    let execStub: SinonStub;
    const sandbox = createSandbox();
    let notificationServiceStub: SinonStub;
    let telemetryServiceStub: SinonStub;
    let withProgressStub: SinonStub;
    const functionInfoJS = { fileName: 'myFunc1', outputdir: 'some/dir', language: 'javascript' };
    const functionInfoJava = { fileName: 'myFunc1', outputdir: 'some/dir', language: 'java' };
    let rootWorkspacePathStub: SinonStub;

    beforeEach(() => {
      execStub = sandbox.stub(cp, 'exec');
      notificationServiceStub = sandbox.stub(notificationService, 'showWarningMessage');
      rootWorkspacePathStub = sandbox.stub(rootWorkspace, 'getRootWorkspacePath');
      rootWorkspacePathStub.returns('');
      telemetryServiceStub = sandbox.stub(telemetryService, 'sendCommandEvent');
      withProgressStub = sandbox.stub(vscode.window, 'withProgress');
      withProgressStub.callsFake((options, task) => {
        task();
      });
    });

    it('Should pull dependencies for javascript', async () => {
      const funcCreate = new ForceFunctionCreateExecutor();
      funcCreate.metadata = FUNCTION_TYPE_JS;
      funcCreate.runPostCommandTasks(functionInfoJS).catch();
      assert.calledOnce(execStub);
      assert.calledWith(execStub, 'npm install', { cwd: path.join('some', 'dir', 'functions', 'myFunc1') });
    });

    it('Should pull dependencies for java', async () => {
      const funcCreate = new ForceFunctionCreateExecutor();
      funcCreate.metadata = FUNCTION_TYPE_JAVA;
      funcCreate.runPostCommandTasks(functionInfoJava).catch();
      assert.calledOnce(execStub);
      /**
       * If this test fails, check if the Java Functions path strategy has changed.
       * Finding the root path for Java in runPostCommandTasks needs to be updated accordingly.
       */
      assert.calledWith(execStub, 'mvn install', { cwd: path.join('some', 'dir', 'functions', 'myFunc1') });
    });

    it('Should call notification service when errored for javascript', async () => {
      const funcCreate = new ForceFunctionCreateExecutor();
      funcCreate.metadata = FUNCTION_TYPE_JS;
      const errorText = 'custom error text';
      execStub.yields(new Error(errorText));
      funcCreate.runPostCommandTasks(functionInfoJS).catch();
      assert.calledOnce(execStub);
      assert.calledWith(execStub, 'npm install', { cwd: path.join('some', 'dir', 'functions', 'myFunc1') });
      assert.calledWith(
        notificationServiceStub,
        nls.localize('force_function_install_npm_dependencies_error', errorText)
      );
    });

    it('Should call notification service when errored for java', async () => {
      const funcCreate = new ForceFunctionCreateExecutor();
      funcCreate.metadata = FUNCTION_TYPE_JAVA;
      const errorText = 'custom error text';
      execStub.yields(new Error(errorText));
      funcCreate.runPostCommandTasks(functionInfoJava).catch();
      assert.calledOnce(execStub);
      assert.calledWith(execStub, 'mvn install', { cwd: path.join('some', 'dir', 'functions', 'myFunc1') });
      assert.calledWith(
        notificationServiceStub,
        nls.localize('force_function_install_mvn_dependencies_error', errorText)
      );
    });

    it('Should log additional language property when creating a java function', async () => {
      const funcCreate = new ForceFunctionCreateExecutor();
      funcCreate.metadata = FUNCTION_TYPE_JAVA;
      funcCreate.build(functionInfoJava);
      funcCreate.logMetric('log_java', [1234, 5678], {});
      assert.calledOnce(telemetryServiceStub);
      expect(telemetryServiceStub.firstCall.args).to.deep.equal(['log_java', [1234, 5678], {language: 'java'}, undefined]);
    });

    it('Should log additional language property when creating a js function', async () => {
      const funcCreate = new ForceFunctionCreateExecutor();
      funcCreate.metadata = FUNCTION_TYPE_JS;
      funcCreate.build(functionInfoJS);
      funcCreate.logMetric('log_javascript', [1234, 5678], {});
      assert.calledOnce(telemetryServiceStub);
      expect(telemetryServiceStub.firstCall.args).to.deep.equal(['log_javascript', [1234, 5678], {language: 'node'}, undefined]);
    });

    afterEach(() => {
      sandbox.restore();
    });
  });
});
