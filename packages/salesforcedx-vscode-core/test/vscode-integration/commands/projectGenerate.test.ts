/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CancelResponse,
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import * as path from 'path';
import * as shell from 'shelljs';
import * as sinon from 'sinon';
import { SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
import * as assert from 'yeoman-assert';
import { channelService } from '../../../src/channels';
import {
  PathExistsChecker,
  ProjectNameAndPathAndTemplate,
  ProjectTemplateItem,
  SelectProjectFolder,
  SelectProjectName,
  SelectProjectTemplate,
  projectGenerateWithManifest,
  projectTemplateEnum,
  sfProjectGenerate
} from '../../../src/commands';
import { ProjectName } from '../../../src/commands/projectGenerate';
import { nls } from '../../../src/messages';
import { notificationService } from '../../../src/notifications';
import { telemetryService } from '../../../src/telemetry';
import { workspaceUtils } from '../../../src/util';

// tslint:disable:no-unused-expression
describe('Project Generate', () => {
  const PROJECT_NAME = 'sfdx-simple';
  const rootWorkspacePath = workspaceUtils.getRootWorkspacePath();
  const PROJECT_NAME_WITH_LEADING_TRAILING_SPACES = `  ${PROJECT_NAME}  `;
  const WORKSPACE_PATH = path.join(rootWorkspacePath, '..');
  const PROJECT_DIR: vscode.Uri[] = [vscode.Uri.parse(WORKSPACE_PATH)];

  describe('SelectProjectTemplate Gatherer', () => {
    let quickPickSpy: sinon.SinonStub;

    beforeEach(() => {
      quickPickSpy = sinon.stub(vscode.window, 'showQuickPick');
      quickPickSpy.onCall(0).returns(undefined);
      quickPickSpy.onCall(1).returns('');
      quickPickSpy
        .onCall(2)
        .returns(
          new ProjectTemplateItem(
            'project_generate_analytics_template_display_text',
            'project_generate_analytics_template'
          )
        );
    });

    afterEach(() => {
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
    let gatherer: SelectProjectName;
    let inputBoxStub: sinon.SinonStub;
    const isContinueResponse = (
      response: CancelResponse | ContinueResponse<ProjectName>
    ): response is ContinueResponse<ProjectName> => {
      return (response as ContinueResponse<ProjectName>).data !== undefined;
    };

    beforeEach(() => {
      gatherer = new SelectProjectName();
      inputBoxStub = sinon.stub(vscode.window, 'showInputBox');
    });

    afterEach(() => {
      inputBoxStub.restore();
    });

    it('Should make one call to showInputBox', async () => {
      inputBoxStub.returns(undefined);
      const response = await gatherer.gather();
      expect(inputBoxStub.calledOnce).to.be.true;
    });

    it('Should return cancel if project name is undefined', async () => {
      inputBoxStub.returns(undefined);
      const response = await gatherer.gather();
      expect(response.type).to.equal('CANCEL');
    });

    it('Should return cancel if user input is empty string', async () => {
      inputBoxStub.returns('');
      const response = await gatherer.gather();
      expect(response.type).to.equal('CANCEL');
    });

    it('Should return Continue with inputted project name if project name is not undefined or empty', async () => {
      inputBoxStub.returns(PROJECT_NAME);

      const response = await gatherer.gather();

      expect(isContinueResponse(response)).to.equal(true);
      if (isContinueResponse(response)) {
        expect(response.type).to.equal('CONTINUE');
        expect(response.data.projectName).to.equal(PROJECT_NAME);
      }
    });

    it('Should return Continue with trimmed project name if project name input has leading and or trailing spaces', async () => {
      inputBoxStub.returns(PROJECT_NAME_WITH_LEADING_TRAILING_SPACES);

      const response = await gatherer.gather();

      expect(isContinueResponse(response)).to.equal(true);
      if (isContinueResponse(response)) {
        expect(response.type).to.equal('CONTINUE');
        expect(response.data.projectName).to.equal(PROJECT_NAME);
      }
    });
  });

  describe('SelectProjectFolder Gatherer', () => {
    let showOpenDialogSpy: sinon.SinonStub;

    beforeEach(() => {
      // showOpenDialog only returns the path or undefined
      showOpenDialogSpy = sinon.stub(vscode.window, 'showOpenDialog');
      showOpenDialogSpy.onCall(0).returns(undefined);
      showOpenDialogSpy.onCall(1).returns(PROJECT_DIR);
    });

    afterEach(() => {
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

    beforeEach(() => {
      showWarningBoxSpy = sinon.stub(vscode.window, 'showWarningMessage');
      showWarningBoxSpy
        .onCall(0)
        .returns(nls.localize('warning_prompt_overwrite_cancel'));
      showWarningBoxSpy
        .onCall(1)
        .returns(nls.localize('warning_prompt_overwrite'));
    });

    afterEach(() => {
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

  describe('Project Generate', () => {
    let showInputBoxStub: SinonStub;
    let quickPickStub: SinonStub;
    let openDialogStub: SinonStub;
    let appendLineStub: SinonStub;
    let showSuccessfulExecutionStub: SinonStub;
    let showFailedExecutionStub: SinonStub;
    let executeCommandStub: SinonStub;
    let sendCommandEventStub: SinonStub;
    let showWarningStub: SinonStub;

    beforeEach(() => {
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
      sendCommandEventStub = stub(telemetryService, 'sendCommandEvent');
      showWarningStub = stub(vscode.window, 'showWarningMessage');
    });

    afterEach(() => {
      showInputBoxStub.restore();
      quickPickStub.restore();
      openDialogStub.restore();
      showSuccessfulExecutionStub.restore();
      showFailedExecutionStub.restore();
      appendLineStub.restore();
      executeCommandStub.restore();
      sendCommandEventStub.restore();
      showWarningStub.restore();
    });

    it('Should Generate Project', async () => {
      // arrange
      const projectPath = path.join(rootWorkspacePath, 'TestProject');
      shell.rm('-rf', projectPath);
      assert.noFile(projectPath);

      quickPickStub.returns({
        label: nls.localize('project_generate_standard_template_display_text')
      });
      showInputBoxStub.returns('TestProject');
      openDialogStub.returns([vscode.Uri.file(path.join(rootWorkspacePath))]);

      // act
      await sfProjectGenerate();

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
        '.forceignore',
        '.gitignore',
        '.prettierignore',
        '.prettierrc',
        'package.json'
      ];
      const vscodearray = ['extensions', 'launch', 'settings'];
      assert.file([
        path.join(
          rootWorkspacePath,
          'TestProject',
          'config',
          'project-scratch-def.json'
        )
      ]);
      assert.file([
        path.join(
          rootWorkspacePath,
          'TestProject',
          'scripts',
          'soql',
          'account.soql'
        )
      ]);
      assert.file([
        path.join(
          rootWorkspacePath,
          'TestProject',
          'scripts',
          'apex',
          'hello.apex'
        )
      ]);
      assert.file([path.join(rootWorkspacePath, 'TestProject', 'README.md')]);
      assert.file([
        path.join(rootWorkspacePath, 'TestProject', 'sfdx-project.json')
      ]);
      assert.fileContent(
        path.join(rootWorkspacePath, 'TestProject', 'sfdx-project.json'),
        '"namespace": "",'
      );
      assert.fileContent(
        path.join(rootWorkspacePath, 'TestProject', 'sfdx-project.json'),
        '"path": "force-app",'
      );
      assert.fileContent(
        path.join(rootWorkspacePath, 'TestProject', 'sfdx-project.json'),
        'sourceApiVersion'
      );
      assert.fileContent(
        path.join(rootWorkspacePath, 'TestProject', 'sfdx-project.json'),
        '"sfdcLoginUrl": "https://login.salesforce.com"'
      );

      for (const file of vscodearray) {
        assert.file([
          path.join(rootWorkspacePath, 'TestProject', '.vscode', `${file}.json`)
        ]);
      }
      assert.file([
        path.join(
          rootWorkspacePath,
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
          rootWorkspacePath,
          'TestProject',
          'force-app',
          'main',
          'default',
          'aura',
          '.eslintrc.json'
        )
      ]);
      for (const file of filestocopy) {
        assert.file([path.join(rootWorkspacePath, 'TestProject', file)]);
      }
      for (const folder of standardfolderarray) {
        assert.file(
          path.join(
            rootWorkspacePath,
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

    it('Should Generate Project with manifest', async () => {
      // arrange
      const projectPath = path.join(rootWorkspacePath, 'TestProject');
      shell.rm('-rf', projectPath);
      assert.noFile(projectPath);

      quickPickStub.returns({
        label: nls.localize('project_generate_standard_template_display_text')
      });
      showInputBoxStub.returns('TestProject');
      openDialogStub.returns([vscode.Uri.file(path.join(rootWorkspacePath))]);

      // act
      await projectGenerateWithManifest();

      assert.file([
        path.join(rootWorkspacePath, 'TestProject', 'manifest', 'package.xml')
      ]);

      // clean up
      shell.rm('-rf', projectPath);
    });
  });
});
