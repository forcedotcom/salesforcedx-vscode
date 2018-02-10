import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  EnterForceIdeUri,
  IsvDebugBootstrapExecutor
} from '../../../src/commands/isvdebugging/bootstrapCmd';
import { nls } from '../../../src/messages';

// tslint:disable:no-unused-expression
describe('ISV Debugging Project Bootstrap Command', () => {
  const LOGIN_URL = 'a.b.c';
  const SESSION_ID = '0x123';
  const PROJECT_NAME = 'sfdx-simple';
  const WORKSPACE_PATH = path.join(vscode.workspace.rootPath!, '..');
  const PROJECT_DIR: vscode.Uri[] = [vscode.Uri.parse(WORKSPACE_PATH)];

  describe('EnterForceIdeUri Gatherer', () => {
    let inputBoxSpy: sinon.SinonStub;
    let showErrorMessageSpy: sinon.SinonStub;

    before(() => {
      inputBoxSpy = sinon.stub(vscode.window, 'showInputBox');
      inputBoxSpy.onCall(0).returns(undefined);
      inputBoxSpy.onCall(1).returns('');
      inputBoxSpy
        .onCall(2)
        .returns(`forceide://abc?url=${LOGIN_URL}&sessionId=${SESSION_ID}`);
      inputBoxSpy.onCall(3).returns(`forceide://abc?url=${LOGIN_URL}`);
      inputBoxSpy.onCall(4).returns(`forceide://abc?sessionId=${SESSION_ID}`);
      showErrorMessageSpy = sinon.stub(vscode.window, 'showErrorMessage');
    });

    after(() => {
      inputBoxSpy.restore();
      showErrorMessageSpy.restore();
    });

    it('Should return cancel if forceide url is undefined', async () => {
      const gatherer = new EnterForceIdeUri();
      const response = await gatherer.gather();
      expect(inputBoxSpy.calledOnce).to.be.true;
      expect(response.type).to.equal('CANCEL');
      expect(showErrorMessageSpy.notCalled).to.be.true;
    });

    it('Should return cancel if user input is empty string', async () => {
      const gatherer = new EnterForceIdeUri();
      const response = await gatherer.gather();
      expect(inputBoxSpy.calledTwice).to.be.true;
      expect(response.type).to.equal('CANCEL');
      expect(showErrorMessageSpy.notCalled).to.be.true;
    });

    it('Should return Continue with inputted url if not undefined or empty', async () => {
      const gatherer = new EnterForceIdeUri();
      const response = await gatherer.gather();
      expect(inputBoxSpy.calledThrice).to.be.true;
      if (response.type === 'CONTINUE') {
        expect(response.data.loginUrl).to.equal(LOGIN_URL);
        expect(response.data.sessionId).to.equal(SESSION_ID);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });

    it('Should return cancel and show error if forceide url is missing sessionId', async () => {
      expect(showErrorMessageSpy.calledOnce).to.be.false;
      const gatherer = new EnterForceIdeUri();
      const response = await gatherer.gather();
      expect(inputBoxSpy.callCount).equal(4);
      expect(response.type).to.equal('CANCEL');
      expect(showErrorMessageSpy.calledOnce).to.be.true;
    });
    it('Should return cancel and show error if forceide url is missing login address', async () => {
      expect(showErrorMessageSpy.calledTwice).to.be.false;
      const gatherer = new EnterForceIdeUri();
      const response = await gatherer.gather();
      expect(inputBoxSpy.callCount).equal(5);
      expect(response.type).to.equal('CANCEL');
      expect(showErrorMessageSpy.calledTwice).to.be.true;
    });
  });

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
        `sfdx force:config:set isvDebuggerSid=${SESSION_ID} isvDebuggerUrl=${LOGIN_URL} instanceUrl=${LOGIN_URL}`
      );
      expect(configureCommand.description).to.equal(
        nls.localize('isv_debug_bootstrap_step1_configure_project')
      );
    });
  });
});
