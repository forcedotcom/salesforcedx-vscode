import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  ForceProjectCreateExecutor,
  PathExistsChecker,
  SelectProjectFolder,
  SelectProjectName
} from '../../src/commands/forceProjectCreate';
import { nls } from '../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Project Create', () => {
  const PROJECT_NAME = 'testProject';
  const PROJECT_DIR = [vscode.Uri.parse('path/to/dir/holding/project')];

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
    let inputBoxSpy: sinon.SinonStub;

    before(() => {
      // showOpenDialog only returns the path or undefined
      inputBoxSpy = sinon.stub(vscode.window, 'showOpenDialog');
      inputBoxSpy.onCall(0).returns(undefined);
      inputBoxSpy.onCall(2).returns(PROJECT_DIR);
    });

    after(() => {
      inputBoxSpy.restore();
    });

    it('Should return cancel if project uri is undefined', async () => {
      const gatherer = new SelectProjectFolder();
      const response = await gatherer.gather();
      expect(inputBoxSpy.calledOnce).to.be.true;
      expect(response.type).to.equal('CANCEL');
    });

    it('Should return Continue with inputted project name if project name is not undefined or empty', async () => {
      const gatherer = new SelectProjectFolder();
      const response = await gatherer.gather();
      expect(inputBoxSpy.calledTwice).to.be.true;
      if (response.type === 'CONTINUE') {
        expect(response.data.projectUri).to.equal(PROJECT_DIR[0].fsPath);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });
  });

  describe('Project Create Builder', () => {
    it('Should build the project create command', async () => {
      const forceProjectCreateBuilder = new ForceProjectCreateExecutor();
      const createCommand = forceProjectCreateBuilder.build({
        projectName: PROJECT_NAME,
        projectUri: PROJECT_DIR[0].fsPath
      });
      expect(createCommand.toCommand()).to.equal(
        `sfdx force:project:create --projectname ${PROJECT_NAME} --outputdir ${PROJECT_DIR}`
      );
      expect(createCommand.description).to.equal(
        nls.localize('force_project_create_text')
      );
    });
  });
});
