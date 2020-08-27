/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import * as path from 'path';
import * as shell from 'shelljs';
import * as sinon from 'sinon';
import { SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
import * as assert from 'yeoman-assert';
import { channelService } from '../../../src/channels';
import {
  ForceProjectCreateExecutor,
  forceProjectWithManifestCreate,
  forceSfdxProjectCreate,
  PathExistsChecker,
  ProjectNameAndPathAndTemplate,
  projectTemplateEnum,
  ProjectTemplateItem,
  SelectProjectFolder,
  SelectProjectName,
  SelectProjectTemplate
} from '../../../src/commands';
import { nls } from '../../../src/messages';
import { notificationService } from '../../../src/notifications';
import { SfdxCoreSettings } from '../../../src/settings/sfdxCoreSettings';
import { getRootWorkspacePath } from '../../../src/util';

// tslint:disable:no-unused-expression
describe('Force Project Create', () => {
  const PROJECT_NAME = 'sfdx-simple';
  const WORKSPACE_PATH = path.join(getRootWorkspacePath(), '..');
  const PROJECT_DIR: vscode.Uri[] = [vscode.Uri.parse(WORKSPACE_PATH)];

  describe('SelectProjectTemplate Gatherer', () => {
    let quickPickSpy: sinon.SinonStub;

    before(() => {
      quickPickSpy = sinon.stub(vscode.window, 'showQuickPick');
      quickPickSpy.onCall(0).returns(undefined);
      quickPickSpy.onCall(1).returns('');
      quickPickSpy
        .onCall(2)
        .returns(
          new ProjectTemplateItem(
            'force_project_create_analytics_template_display_text',
            'force_project_create_analytics_template'
          )
        );
    });

    after(() => {
      quickPickSpy.restore();
    });

    it('Should return cancel if project template is undefined', async () => {
      const gatherer = new SelectProjectTemplate();
      const response = await gatherer.gather();
      expect(quickPickSpy.calledOnce).to.be.true;
      expect(response.type).to.equal('CANCEL');
    });

    it('Should return cancel if user input is empty string', async () => {
      const gatherer = new SelectProjectTemplate();
      const response = await gatherer.gather();
      expect(quickPickSpy.calledTwice).to.be.true;
      expect(response.type).to.equal('CANCEL');
    });

    it('Should return Continue with inputted project template if project template set', async () => {
      const gatherer = new SelectProjectTemplate();
      const response = await gatherer.gather();
      expect(quickPickSpy.calledThrice).to.be.true;
      if (response.type === 'CONTINUE') {
        expect(response.data.projectTemplate).to.equal(
          projectTemplateEnum.analytics
        );
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });
  });

  describe('SelectProjectName Gatherer', () => {
    let inputBoxSpy: sinon.SinonStub;

    before(() => {
      inputBoxSpy = sinon.stub(vscode.window, 'showInputBox');
      inputBoxSpy.onCall(0).returns(undefined);
      inputBoxSpy.onCall(1).returns('');
      inputBoxSpy.onCall(2).returns(PROJECT_NAME);
    });

    after(() => {
      inputBoxSpy.restore();
    });

    it('Should return cancel if project name is undefined', async () => {
      const gatherer = new SelectProjectName();
      const response = await gatherer.gather();
      expect(inputBoxSpy.calledOnce).to.be.true;
      expect(response.type).to.equal('CANCEL');
    });

    it('Should return cancel if user input is empty string', async () => {
      const gatherer = new SelectProjectName();
      const response = await gatherer.gather();
      expect(inputBoxSpy.calledTwice).to.be.true;
      expect(response.type).to.equal('CANCEL');
    });

    it('Should return Continue with inputted project name if project name is not undefined or empty', async () => {
      const gatherer = new SelectProjectName();
      const response = await gatherer.gather();
      expect(inputBoxSpy.calledThrice).to.be.true;
      if (response.type === 'CONTINUE') {
        expect(response.data.projectName).to.equal(PROJECT_NAME);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });
  });

  describe('SelectProjectFolder Gatherer', () => {
    let showOpenDialogSpy: sinon.SinonStub;

    before(() => {
      // showOpenDialog only returns the path or undefined
      showOpenDialogSpy = sinon.stub(vscode.window, 'showOpenDialog');
      showOpenDialogSpy.onCall(0).returns(undefined);
      showOpenDialogSpy.onCall(1).returns(PROJECT_DIR);
    });

    after(() => {
      showOpenDialogSpy.restore();
    });

    it('Should return cancel if project uri is undefined', async () => {
      const gatherer = new SelectProjectFolder();
      const response = await gatherer.gather();
      expect(showOpenDialogSpy.calledOnce).to.be.true;
      expect(response.type).to.equal('CANCEL');
    });

    it('Should return Continue with inputted project name if project name is not undefined or empty', async () => {
      const gatherer = new SelectProjectFolder();
      const response = await gatherer.gather();
      expect(showOpenDialogSpy.calledTwice).to.be.true;
      if (response.type === 'CONTINUE') {
        expect(response.data.projectUri).to.equal(PROJECT_DIR[0].fsPath);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });
  });

  describe('PathExistsChecker PostCondition', () => {
    let showWarningBoxSpy: sinon.SinonStub;

    before(() => {
      showWarningBoxSpy = sinon.stub(vscode.window, 'showWarningMessage');
      showWarningBoxSpy
        .onCall(0)
        .returns(nls.localize('warning_prompt_overwrite_cancel'));
      showWarningBoxSpy
        .onCall(1)
        .returns(nls.localize('warning_prompt_overwrite'));
    });

    after(() => {
      showWarningBoxSpy.restore();
    });

    it('Should return cancel if project path is in use and user selects No', async () => {
      const checker = new PathExistsChecker();
      const response = await checker.check({
        type: 'CONTINUE',
        data: {
          projectName: PROJECT_NAME,
          projectUri: PROJECT_DIR[0].fsPath,
          projectTemplate: projectTemplateEnum.standard
        }
      });
      expect(showWarningBoxSpy.calledOnce).to.be.true;
      expect(response.type).to.equal('CANCEL');
    });

    it('Should return inputs if project path is in use and user selects No', async () => {
      const checker = new PathExistsChecker();
      const inputs: ContinueResponse<ProjectNameAndPathAndTemplate> = {
        type: 'CONTINUE',
        data: {
          projectName: PROJECT_NAME,
          projectUri: PROJECT_DIR[0].fsPath,
          projectTemplate: projectTemplateEnum.standard
        }
      };
      const response = await checker.check(inputs);
      expect(showWarningBoxSpy.calledTwice).to.be.true;
      expect(response.type).to.equal('CONTINUE');
      if (response.type === 'CONTINUE') {
        expect(response.data).to.equal(inputs.data);
      }
    });

    it('Should return inputs if project path is not in use', async () => {
      const checker = new PathExistsChecker();
      const inputs: ContinueResponse<ProjectNameAndPathAndTemplate> = {
        type: 'CONTINUE',
        data: {
          projectName: 'someOtherProject',
          projectUri: PROJECT_DIR[0].fsPath,
          projectTemplate: projectTemplateEnum.standard
        }
      };
      const response = await checker.check(inputs);
      expect(showWarningBoxSpy.calledThrice).to.be.false;
      expect(response.type).to.equal('CONTINUE');
      if (response.type === 'CONTINUE') {
        expect(response.data).to.equal(inputs.data);
      }
    });
  });

  describe('Project Create Builder', () => {
    it('Should build the project create command', async () => {
      const forceProjectCreateBuilder = new ForceProjectCreateExecutor();
      const createCommand = forceProjectCreateBuilder.build({
        projectName: PROJECT_NAME,
        projectUri: PROJECT_DIR[0].fsPath,
        projectTemplate: projectTemplateEnum.standard
      });
      expect(createCommand.toCommand()).to.equal(
        `sfdx force:project:create --projectname ${PROJECT_NAME} --outputdir ${
          PROJECT_DIR[0].fsPath
        } --template standard`
      );
      expect(createCommand.description).to.equal(
        nls.localize('force_project_create_text')
      );
    });

    it('Should build the analytics project create command', async () => {
      const forceProjectCreateBuilder = new ForceProjectCreateExecutor();
      const createCommand = forceProjectCreateBuilder.build({
        projectName: PROJECT_NAME,
        projectUri: PROJECT_DIR[0].fsPath,
        projectTemplate: projectTemplateEnum.analytics
      });
      expect(createCommand.toCommand()).to.equal(
        `sfdx force:project:create --projectname ${PROJECT_NAME} --outputdir ${
          PROJECT_DIR[0].fsPath
        } --template analytics`
      );
      expect(createCommand.description).to.equal(
        nls.localize('force_project_create_text')
      );
    });

    it('Should build the analytics project with manifest create command', async () => {
      const forceProjectCreateBuilder = new ForceProjectCreateExecutor({
        isProjectWithManifest: true
      });
      const createCommand = forceProjectCreateBuilder.build({
        projectName: PROJECT_NAME,
        projectUri: PROJECT_DIR[0].fsPath,
        projectTemplate: projectTemplateEnum.analytics
      });
      expect(createCommand.toCommand()).to.equal(
        `sfdx force:project:create --projectname ${PROJECT_NAME} --outputdir ${
          PROJECT_DIR[0].fsPath
        } --template analytics --manifest`
      );
      expect(createCommand.description).to.equal(
        nls.localize('force_project_create_text')
      );
    });

    it('Should build the project with manifest create command', async () => {
      const forceProjectCreateBuilder = new ForceProjectCreateExecutor({
        isProjectWithManifest: true
      });
      const createCommand = forceProjectCreateBuilder.build({
        projectName: PROJECT_NAME,
        projectUri: PROJECT_DIR[0].fsPath,
        projectTemplate: projectTemplateEnum.standard
      });
      expect(createCommand.toCommand()).to.equal(
        `sfdx force:project:create --projectname ${PROJECT_NAME} --outputdir ${
          PROJECT_DIR[0].fsPath
        } --template standard --manifest`
      );
      expect(createCommand.description).to.equal(
        nls.localize('force_project_create_text')
      );
    });
  });

  describe('Library Create', () => {
    let settings: SinonStub;
    let showInputBoxStub: SinonStub;
    let quickPickStub: SinonStub;
    let openDialogStub: SinonStub;
    let appendLineStub: SinonStub;
    let showSuccessfulExecutionStub: SinonStub;
    let showFailedExecutionStub: SinonStub;
    let executeCommandStub: SinonStub;

    let showWarningStub: SinonStub;

    beforeEach(() => {
      // mock experimental setting
      settings = stub(SfdxCoreSettings.prototype, 'getTemplatesLibrary');
      settings.returns(true);
      showInputBoxStub = stub(vscode.window, 'showInputBox');
      quickPickStub = stub(vscode.window, 'showQuickPick');
      openDialogStub = stub(vscode.window, 'showOpenDialog');
      appendLineStub = stub(channelService, 'appendLine');
      showSuccessfulExecutionStub = stub(
        notificationService,
        'showSuccessfulExecution'
      );
      showSuccessfulExecutionStub.returns(Promise.resolve());
      showFailedExecutionStub = stub(
        notificationService,
        'showFailedExecution'
      );
      executeCommandStub = stub(vscode.commands, 'executeCommand');

      showWarningStub = stub(vscode.window, 'showWarningMessage');
    });

    afterEach(() => {
      settings.restore();
      showInputBoxStub.restore();
      quickPickStub.restore();
      openDialogStub.restore();
      showSuccessfulExecutionStub.restore();
      showFailedExecutionStub.restore();
      appendLineStub.restore();
      executeCommandStub.restore();

      showWarningStub.restore();
    });

    it('Should Create Project', async () => {
      // arrange
      const projectPath = path.join(getRootWorkspacePath(), 'TestProject');
      shell.rm('-rf', projectPath);
      assert.noFile(projectPath);

      quickPickStub.returns({
        label: nls.localize(
          'force_project_create_standard_template_display_text'
        )
      });
      showInputBoxStub.returns('TestProject');
      openDialogStub.returns([
        vscode.Uri.file(path.join(getRootWorkspacePath()))
      ]);

      // act
      await forceSfdxProjectCreate();

      const standardfolderarray = [
        'aura',
        'applications',
        'classes',
        'contentassets',
        'flexipages',
        'layouts',
        'objects',
        'permissionsets',
        'staticresources',
        'tabs',
        'triggers'
      ];
      const filestocopy = [
        '.eslintignore',
        '.forceignore',
        '.gitignore',
        '.prettierignore',
        '.prettierrc',
        'package.json'
      ];
      const vscodearray = ['extensions', 'launch', 'settings'];
      assert.file([
        path.join(
          getRootWorkspacePath(),
          'TestProject',
          'config',
          'project-scratch-def.json'
        )
      ]);
      assert.file([
        path.join(
          getRootWorkspacePath(),
          'TestProject',
          'scripts',
          'soql',
          'account.soql'
        )
      ]);
      assert.file([
        path.join(
          getRootWorkspacePath(),
          'TestProject',
          'scripts',
          'apex',
          'hello.apex'
        )
      ]);
      assert.file([
        path.join(getRootWorkspacePath(), 'TestProject', 'README.md')
      ]);
      assert.file([
        path.join(getRootWorkspacePath(), 'TestProject', 'sfdx-project.json')
      ]);
      assert.fileContent(
        path.join(getRootWorkspacePath(), 'TestProject', 'sfdx-project.json'),
        '"namespace": "",'
      );
      assert.fileContent(
        path.join(getRootWorkspacePath(), 'TestProject', 'sfdx-project.json'),
        '"path": "force-app",'
      );
      assert.fileContent(
        path.join(getRootWorkspacePath(), 'TestProject', 'sfdx-project.json'),
        'sourceApiVersion'
      );
      assert.fileContent(
        path.join(getRootWorkspacePath(), 'TestProject', 'sfdx-project.json'),
        '"sfdcLoginUrl": "https://login.salesforce.com"'
      );

      for (const file of vscodearray) {
        assert.file([
          path.join(
            getRootWorkspacePath(),
            'TestProject',
            '.vscode',
            `${file}.json`
          )
        ]);
      }
      assert.file([
        path.join(
          getRootWorkspacePath(),
          'TestProject',
          'force-app',
          'main',
          'default',
          'lwc',
          '.eslintrc.json'
        )
      ]);
      assert.file([
        path.join(
          getRootWorkspacePath(),
          'TestProject',
          'force-app',
          'main',
          'default',
          'aura',
          '.eslintrc.json'
        )
      ]);
      for (const file of filestocopy) {
        assert.file([path.join(getRootWorkspacePath(), 'TestProject', file)]);
      }
      for (const folder of standardfolderarray) {
        assert.file(
          path.join(
            getRootWorkspacePath(),
            'TestProject',
            'force-app',
            'main',
            'default',
            folder
          )
        );
      }

      // clean up
      shell.rm('-rf', projectPath);
    });

    it('Should Create Project with manifest', async () => {
      // arrange
      const projectPath = path.join(getRootWorkspacePath(), 'TestProject');
      shell.rm('-rf', projectPath);
      assert.noFile(projectPath);

      quickPickStub.returns({
        label: nls.localize(
          'force_project_create_standard_template_display_text'
        )
      });
      showInputBoxStub.returns('TestProject');
      openDialogStub.returns([
        vscode.Uri.file(path.join(getRootWorkspacePath()))
      ]);

      // act
      await forceProjectWithManifestCreate();

      assert.file([
        path.join(
          getRootWorkspacePath(),
          'TestProject',
          'manifest',
          'package.xml'
        )
      ]);

      // clean up
      shell.rm('-rf', projectPath);
    });
  });
});
