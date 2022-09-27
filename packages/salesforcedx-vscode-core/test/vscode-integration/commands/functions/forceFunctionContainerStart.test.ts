/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getFunctionsBinary } from '@heroku/functions-core';
import * as library from '@heroku/functions-core';
import { TelemetryService } from '@salesforce/salesforcedx-utils-vscode';
import { EventEmitter } from 'events';
import * as path from 'path';
import { assert, createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { Uri, window } from 'vscode';
import { channelService } from '../../../../src/channels';
import { forceFunctionContainerStartCommand } from '../../../../src/commands/functions/forceFunctionContainerStartCommand';
import { FunctionService } from '../../../../src/commands/functions/functionService';
import { nls } from '../../../../src/messages';
import {
  notificationService,
  ProgressNotification
} from '../../../../src/notifications';
import { taskViewService } from '../../../../src/statuses';
import { telemetryService } from '../../../../src/telemetry';
import { OrgAuthInfo, workspaceUtils } from '../../../../src/util';

describe('Force Function Start Integration Tests.', () => {
  describe('execute', () => {
    let sandbox: SinonSandbox;
    const functionsBinaryStub: {
      [key: string]: SinonStub;
    } = {};
    let emitter: EventEmitter;
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
    let getDefaultUsernameOrAliasStub: SinonStub;
    beforeEach(() => {
      sandbox = createSandbox();
      functionsBinaryStub.run = sandbox.stub();
      functionsBinaryStub.run.returns(Promise.resolve(true));
      functionsBinaryStub.build = sandbox.stub();
      functionsBinaryStub.build.returns(Promise.resolve(true));
      functionsBinaryStub.on = sandbox.stub();
      emitter = new EventEmitter();
      functionsBinaryStub.on.callsFake(
        (event: string | symbol, listener: (...args: any[]) => void) => {
          emitter.on(event, listener);
        }
      );
      sandbox.stub(library, 'getFunctionsBinary').returns(functionsBinaryStub);

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
      notificationServiceStubs.showInformationMessageStub = sandbox.stub(
        notificationService,
        'showInformationMessage'
      );
      notificationServiceStubs.showWarningMessageStub = sandbox.stub(
        notificationService,
        'showWarningMessage'
      );
      notificationServiceStubs.showErrorMessageStub = sandbox.stub(
        notificationService,
        'showErrorMessage'
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
        TelemetryService.prototype,
        'sendCommandEvent'
      );
      hrtimeStub = sandbox.stub(process, 'hrtime');
      getDefaultUsernameOrAliasStub = sandbox.stub(
        OrgAuthInfo,
        'getDefaultUsernameOrAlias'
      );
      getDefaultUsernameOrAliasStub.returns(
        Promise.resolve('test@example.com')
      );
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('Should start function from folder', async () => {
      const srcUri = Uri.file(
        path.join(
          workspaceUtils.getRootWorkspacePath(),
          'functions',
          'demoJavaScriptFunction'
        )
      );

      await forceFunctionContainerStartCommand(srcUri);
      assert.calledOnce(functionsBinaryStub.build);
      assert.calledOnce(functionsBinaryStub.run);
    });

    it('Should start function from file', async () => {
      const srcUri = Uri.file(
        path.join(
          workspaceUtils.getRootWorkspacePath(),
          'functions',
          'demoJavaScriptFunction',
          'index.js'
        )
      );

      await forceFunctionContainerStartCommand(srcUri);

      assert.calledOnce(functionsBinaryStub.build);
      assert.calledOnce(functionsBinaryStub.run);
    });

    it('Should start function from active text editor if sourceUri not specified', async () => {
      const srcUri = Uri.file(
        path.join(
          workspaceUtils.getRootWorkspacePath(),
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
      await forceFunctionContainerStartCommand();

      assert.calledOnce(functionsBinaryStub.build);
      assert.calledOnce(functionsBinaryStub.run);
    });

    it('Should show warning and log telemetry if sourceUri not specified and not actively editing a function file', async () => {
      const srcUri = Uri.file(
        path.join(
          workspaceUtils.getRootWorkspacePath(),
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

      await forceFunctionContainerStartCommand();

      assert.notCalled(functionsBinaryStub.build);
      assert.calledOnce(notificationServiceStubs.showWarningMessageStub);
      assert.calledWith(
        notificationServiceStubs.showWarningMessageStub,
        nls.localize('force_function_start_warning_not_in_function_folder')
      );
      assert.calledOnce(telemetryServiceStubs.sendExceptionStub);
      assert.calledWith(
        telemetryServiceStubs.sendExceptionStub,
        'force_function_start_not_in_function_folder',
        nls.localize('force_function_start_warning_not_in_function_folder')
      );
    });

    it('Should show warning and log telemetry if start function from a non-function folder', async () => {
      const srcUri = Uri.file(
        path.join(
          workspaceUtils.getRootWorkspacePath(),
          'force-app/main/default/lwc'
        )
      );
      await forceFunctionContainerStartCommand(srcUri);

      assert.notCalled(functionsBinaryStub.build);
      assert.calledOnce(notificationServiceStubs.showWarningMessageStub);
      assert.calledWith(
        notificationServiceStubs.showWarningMessageStub,
        nls.localize('force_function_start_warning_no_toml')
      );
      assert.calledOnce(telemetryServiceStubs.sendExceptionStub);
      assert.calledWith(
        telemetryServiceStubs.sendExceptionStub,
        'force_function_start_no_toml',
        nls.localize('force_function_start_warning_no_toml')
      );
    });

    it('Should stream output to channel', async () => {
      const srcUri = Uri.file(
        path.join(
          workspaceUtils.getRootWorkspacePath(),
          'functions',
          'demoJavaScriptFunction'
        )
      );
      await forceFunctionContainerStartCommand(srcUri);

      assert.calledOnce(channelServiceStubs.showChannelOutputStub);
    });

    it('Should log telemetry on successful execution', async () => {
      const srcUri = Uri.file(
        path.join(
          workspaceUtils.getRootWorkspacePath(),
          'functions',
          'demoJavaScriptFunction'
        )
      );
      const mockStartTime = [1234, 5678];
      hrtimeStub.returns(mockStartTime);

      await forceFunctionContainerStartCommand(srcUri);

      assert.calledOnce(logMetricStub);
      assert.calledWith(
        logMetricStub,
        'force_function_container_start',
        mockStartTime,
        {
          language: 'node',
          success: 'true'
        }
      );
    });

    it('Should show error message and send telemetry if docker is not installed or started', async () => {
      const srcUri = Uri.file(
        path.join(
          workspaceUtils.getRootWorkspacePath(),
          'functions',
          'demoJavaScriptFunction'
        )
      );
      await forceFunctionContainerStartCommand(srcUri);
      emitter.emit('error', {
        text:
          'Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?'
      });

      assert.calledOnce(telemetryServiceStubs.sendExceptionStub);
      assert.calledWith(
        telemetryServiceStubs.sendExceptionStub,
        'force_function_start_docker_plugin_not_installed_or_started',
        nls.localize(
          'force_function_start_warning_docker_not_installed_or_not_started'
        )
      );
      assert.calledOnce(notificationServiceStubs.showErrorMessageStub);
      assert.calledWith(
        notificationServiceStubs.showErrorMessageStub,
        nls.localize(
          'force_function_start_warning_docker_not_installed_or_not_started'
        )
      );
    });

    it('Should show error message and send telemetry if error is not expected', async () => {
      const srcUri = Uri.file(
        path.join(
          workspaceUtils.getRootWorkspacePath(),
          'functions',
          'demoJavaScriptFunction'
        )
      );

      await forceFunctionContainerStartCommand(srcUri);

      emitter.emit('error', { text: '' });

      assert.calledOnce(telemetryServiceStubs.sendExceptionStub);
      assert.calledWith(
        telemetryServiceStubs.sendExceptionStub,
        'force_function_start_unexpected_error',
        nls.localize('force_function_start_unexpected_error')
      );
      assert.calledOnce(notificationServiceStubs.showErrorMessageStub);
      assert.calledWith(
        notificationServiceStubs.showErrorMessageStub,
        nls.localize('force_function_start_unexpected_error')
      );
    });

    it('Should not show informational message when default org is set', async () => {
      getDefaultUsernameOrAliasStub.returns(
        Promise.resolve('test@example.com')
      );

      const srcUri = Uri.file(
        path.join(
          workspaceUtils.getRootWorkspacePath(),
          'functions',
          'demoJavaScriptFunction'
        )
      );

      await forceFunctionContainerStartCommand(srcUri);

      assert.notCalled(notificationServiceStubs.showInformationMessageStub);
    });

    it('Should show informational message when no default org is set', async () => {
      getDefaultUsernameOrAliasStub.returns(Promise.resolve(undefined));

      const srcUri = Uri.file(
        path.join(
          workspaceUtils.getRootWorkspacePath(),
          'functions',
          'demoJavaScriptFunction'
        )
      );
      await forceFunctionContainerStartCommand(srcUri);

      assert.calledOnce(notificationServiceStubs.showInformationMessageStub);
      assert.calledWith(
        notificationServiceStubs.showInformationMessageStub,
        nls.localize('force_function_start_no_org_auth')
      );
    });
    it('Should not capture debug language type for random pattern', async () => {
      const functionServiceStub = sandbox.stub(
        FunctionService.prototype,
        'updateFunction'
      );
      const srcUri = Uri.file(
        path.join(
          workspaceUtils.getRootWorkspacePath(),
          'functions',
          'demoJavaScriptFunction'
        )
      );

      hrtimeStub.returns([1234, 5678]);

      await forceFunctionContainerStartCommand(srcUri);

      emitter.emit('log', { text: 'heroku/nodejs-engine' });
      assert.notCalled(functionServiceStub);
    });

    it('Should capture debug language type for Java runtime', async () => {
      const functionServiceStub = sandbox.stub(
        FunctionService.prototype,
        'updateFunction'
      );
      const srcUri = Uri.file(
        path.join(
          workspaceUtils.getRootWorkspacePath(),
          'functions',
          'demoJavaScriptFunction'
        )
      );

      hrtimeStub.returns([1234, 5678]);

      await forceFunctionContainerStartCommand(srcUri);

      emitter.emit('log', { text: ' heroku/jvm-function-invoker@latest' });
      assert.calledOnce(functionServiceStub);
      assert.calledWith(functionServiceStub, srcUri.fsPath, 'jvm');
    });

    it('Should capture debug language type for Node runtime', async () => {
      const functionServiceStub = sandbox.stub(
        FunctionService.prototype,
        'updateFunction'
      );
      const srcUri = Uri.file(
        path.join(
          workspaceUtils.getRootWorkspacePath(),
          'functions',
          'demoJavaScriptFunction'
        )
      );

      hrtimeStub.returns([1234, 5678]);

      await forceFunctionContainerStartCommand(srcUri);
      emitter.emit('log', { text: 'heroku/nodejs-function-invoker@2.1.1' });
      assert.calledOnce(functionServiceStub);
      assert.calledWith(functionServiceStub, srcUri.fsPath, 'nodejs');
    });
  });
});
