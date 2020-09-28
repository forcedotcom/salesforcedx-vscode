/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as cp from 'child_process';
import { match, SinonStub, stub } from 'sinon';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ForceFunctionCreateExecutor } from '../../../../src/commands/templates/forceFunctionCreate';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { SfdxCoreSettings } from '../../../../src/settings/sfdxCoreSettings';

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
        'sfdx evergreen:function:create myFunc1 --language javascript'
      );
      expect(funcCreateCmd.description).to.equal(
        nls.localize('force_function_create_text')
      );
      expect(funcCreate.getFileExtension()).to.equal('.js');
    });

    it('Should build apex function create command for typescript', async () => {
      const funcCreate = new ForceFunctionCreateExecutor();
      const fileName = 'myFunc2';
      const funcCreateCmd = funcCreate.build({
        fileName,
        language: 'typescript',
        outputdir: ''
      });

      expect(funcCreateCmd.toCommand()).to.equal(
        'sfdx evergreen:function:create myFunc2 --language typescript'
      );
      expect(funcCreateCmd.description).to.equal(
        nls.localize('force_function_create_text')
      );
      expect(funcCreate.getFileExtension()).to.equal('.ts');
    });
  });

  describe('Pull Dependencies', () => {
    let execStub: SinonStub;
    let settings: SinonStub;
    let notificationServiceStub: SinonStub;
    let withProgressStub: SinonStub;

    beforeEach(() => {
      execStub = stub(cp, 'exec');
      settings = stub(
        SfdxCoreSettings.prototype,
        'getFunctionsPullDependencies'
      );
      notificationServiceStub = stub(notificationService, 'showWarningMessage');
      withProgressStub = stub(vscode.window, 'withProgress');
      withProgressStub.callsFake((options, task) => {
        task();
      });
    });

    it('Should pull dependencies when settings on', async () => {
      const funcCreate = new ForceFunctionCreateExecutor();
      settings.returns(true);
      funcCreate.runPostCommandTasks('some/dir');
      sinon.assert.calledOnce(execStub);
      sinon.assert.calledWith(execStub, 'npm install', { cwd: 'some/dir' });
    });

    it('Should show install dependencies progress', async () => {
      const funcCreate = new ForceFunctionCreateExecutor();
      settings.returns(true);
      funcCreate.runPostCommandTasks('some/dir');
      sinon.assert.calledOnce(withProgressStub);
      sinon.assert.calledWith(
        withProgressStub,
        {
          location: vscode.ProgressLocation.Window,
          title: nls.localize(
            'force_function_install_npm_dependencies_progress'
          ),
          cancellable: true
        },
        match.any
      );
    });

    it('Should not pull dependencies when settings off', async () => {
      const funcCreate = new ForceFunctionCreateExecutor();
      settings.returns(false);
      funcCreate.runPostCommandTasks('some/dir');
      sinon.assert.notCalled(execStub);
    });

    it('Should call notification service when errored', async () => {
      const funcCreate = new ForceFunctionCreateExecutor();
      settings.returns(true);
      const errorText = 'custom error text';
      execStub.yields(new Error(errorText));
      funcCreate.runPostCommandTasks('some/dir');
      sinon.assert.calledOnce(execStub);
      sinon.assert.calledWith(execStub, 'npm install', { cwd: 'some/dir' });
      sinon.assert.calledWith(
        notificationServiceStub,
        nls.localize('force_function_install_npm_dependencies_error', errorText)
      );
    });

    afterEach(() => {
      execStub.restore();
      settings.restore();
      notificationServiceStub.restore();
      withProgressStub.restore();
    });
  });
});
