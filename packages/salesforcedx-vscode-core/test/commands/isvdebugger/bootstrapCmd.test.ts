import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { IsvDebugBootstrapExecutor } from '../../../src/commands/isvdebugging/bootstrapCmd';
import { nls } from '../../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Project Create', () => {
  const LOGIN_URL = 'a.b.c';
  const SESSION_ID = '0x123';
  const PROJECT_NAME = 'sfdx-simple';
  const WORKSPACE_PATH = path.join(vscode.workspace.rootPath!, '..');
  const PROJECT_DIR: vscode.Uri[] = [vscode.Uri.parse(WORKSPACE_PATH)];

  // describe('SelectProjectName Gatherer', () => {
  //   let inputBoxSpy: sinon.SinonStub;

  //   before(() => {
  //     inputBoxSpy = sinon.stub(vscode.window, 'showInputBox');
  //     inputBoxSpy.onCall(0).returns(undefined);
  //     inputBoxSpy.onCall(1).returns('');
  //     inputBoxSpy.onCall(2).returns(PROJECT_NAME);
  //   });

  //   after(() => {
  //     inputBoxSpy.restore();
  //   });

  //   it('Should return cancel if project name is undefined', async () => {
  //     const gatherer = new SelectProjectName();
  //     const response = await gatherer.gather();
  //     expect(inputBoxSpy.calledOnce).to.be.true;
  //     expect(response.type).to.equal('CANCEL');
  //   });

  //   it('Should return cancel if user input is empty string', async () => {
  //     const gatherer = new SelectProjectName();
  //     const response = await gatherer.gather();
  //     expect(inputBoxSpy.calledTwice).to.be.true;
  //     expect(response.type).to.equal('CANCEL');
  //   });

  //   it('Should return Continue with inputted project name if project name is not undefined or empty', async () => {
  //     const gatherer = new SelectProjectName();
  //     const response = await gatherer.gather();
  //     expect(inputBoxSpy.calledThrice).to.be.true;
  //     if (response.type === 'CONTINUE') {
  //       expect(response.data.projectName).to.equal(PROJECT_NAME);
  //     } else {
  //       expect.fail('Response should be of type ContinueResponse');
  //     }
  //   });
  // });

  // describe('SelectProjectFolder Gatherer', () => {
  //   let showOpenDialogSpy: sinon.SinonStub;

  //   before(() => {
  //     // showOpenDialog only returns the path or undefined
  //     showOpenDialogSpy = sinon.stub(vscode.window, 'showOpenDialog');
  //     showOpenDialogSpy.onCall(0).returns(undefined);
  //     showOpenDialogSpy.onCall(1).returns(PROJECT_DIR);
  //   });

  //   after(() => {
  //     showOpenDialogSpy.restore();
  //   });

  //   it('Should return cancel if project uri is undefined', async () => {
  //     const gatherer = new SelectProjectFolder();
  //     const response = await gatherer.gather();
  //     expect(showOpenDialogSpy.calledOnce).to.be.true;
  //     expect(response.type).to.equal('CANCEL');
  //   });

  //   it('Should return Continue with inputted project name if project name is not undefined or empty', async () => {
  //     const gatherer = new SelectProjectFolder();
  //     const response = await gatherer.gather();
  //     expect(showOpenDialogSpy.calledTwice).to.be.true;
  //     if (response.type === 'CONTINUE') {
  //       expect(response.data.projectUri).to.equal(PROJECT_DIR[0].fsPath);
  //     } else {
  //       expect.fail('Response should be of type ContinueResponse');
  //     }
  //   });
  // });

  // describe('PathExistsChecker PostCondition', () => {
  //   let showWarningBoxSpy: sinon.SinonStub;

  //   before(() => {
  //     showWarningBoxSpy = sinon.stub(vscode.window, 'showWarningMessage');
  //     showWarningBoxSpy.onCall(0).returns(nls.localize('warning_prompt_no'));
  //     showWarningBoxSpy.onCall(1).returns(nls.localize('warning_prompt_yes'));
  //   });

  //   after(() => {
  //     showWarningBoxSpy.restore();
  //   });

  //   it('Should return cancel if project path is in use and user selects No', async () => {
  //     const checker = new PathExistsChecker();
  //     const response = await checker.check({
  //       type: 'CONTINUE',
  //       data: { projectName: PROJECT_NAME, projectUri: PROJECT_DIR[0].fsPath }
  //     });
  //     expect(showWarningBoxSpy.calledOnce).to.be.true;
  //     expect(response.type).to.equal('CANCEL');
  //   });
  // });

  describe('CLI Builder', () => {
    it('Should build the project create command', async () => {
      const forceProjectCreateBuilder = new IsvDebugBootstrapExecutor();
      const createCommand = forceProjectCreateBuilder.buildCreateProjectCommand(
        {
          loginUrl: LOGIN_URL,
          sessionId: SESSION_ID,
          projectName: PROJECT_NAME,
          projectUri: PROJECT_DIR[0].fsPath
        }
      );
      expect(createCommand.toCommand()).to.equal(
        `sfdx force:project:create --projectname ${PROJECT_NAME} --outputdir ${PROJECT_DIR[0]
          .fsPath}`
      );
      expect(createCommand.description).to.equal(
        nls.localize('isv_debug_bootstrap_step1_create_project')
      );
    });

    it('Should build the project configure command', async () => {
      const forceProjectConfigBuilder = new IsvDebugBootstrapExecutor();
      const configureCommand = forceProjectConfigBuilder.buildConfigureProjectCommand(
        {
          loginUrl: LOGIN_URL,
          sessionId: SESSION_ID,
          projectName: PROJECT_NAME,
          projectUri: PROJECT_DIR[0].fsPath
        }
      );
      expect(configureCommand.toCommand()).to.equal(
        `sfdx force:config:set isvDebuggerUrl=${LOGIN_URL} isvDebuggerSid=${SESSION_ID}`
      );
      expect(configureCommand.description).to.equal(
        nls.localize('isv_debug_bootstrap_step1_configure_project')
      );
    });
  });
});
