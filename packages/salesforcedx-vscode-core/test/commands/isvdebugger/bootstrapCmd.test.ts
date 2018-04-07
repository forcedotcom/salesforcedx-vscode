import * as AdmZip from 'adm-zip';
import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ContinueResponse } from '../../../../salesforcedx-utils-vscode/out/src/types/index';
import {
  EnterForceIdeUri,
  IsvDebugBootstrapConfig,
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
      inputBoxSpy
        .onCall(5)
        .returns(`forceide://abc?url=${LOGIN_URL}&sessionId=${SESSION_ID}`);
      inputBoxSpy
        .onCall(6)
        .returns(
          `forceide://abc?url=${LOGIN_URL}&secure=0&sessionId=${SESSION_ID}`
        );
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
        expect(response.data.loginUrl).to.not.be.undefined;
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

    it('Should add proper https:// prefix for url', async () => {
      const gatherer = new EnterForceIdeUri();
      const response = await gatherer.gather();
      expect(inputBoxSpy.callCount).equal(6);
      if (response.type === 'CONTINUE') {
        expect(response.data.loginUrl).to.equal('https://' + LOGIN_URL);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });

    it('Should add proper http:// prefix for non-secure url', async () => {
      const gatherer = new EnterForceIdeUri();
      const response = await gatherer.gather();
      expect(inputBoxSpy.callCount).equal(7);
      if (response.type === 'CONTINUE') {
        expect(response.data.loginUrl).to.equal('http://' + LOGIN_URL);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });
  });

  describe('CLI Builder', () => {
    it('Verify buildCreateProjectCommand', async () => {
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

    it('Verify buildConfigureProjectCommand', async () => {
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
        nls.localize('isv_debug_bootstrap_step2_configure_project')
      );
    });

    it('Verify buildQueryForOrgNamespacePrefixCommand', async () => {
      const forceProjectConfigBuilder = new IsvDebugBootstrapExecutor();
      const command = forceProjectConfigBuilder.buildQueryForOrgNamespacePrefixCommand(
        {
          loginUrl: LOGIN_URL,
          sessionId: SESSION_ID,
          projectName: PROJECT_NAME,
          projectUri: PROJECT_DIR[0].fsPath
        }
      );
      expect(command.toCommand()).to.equal(
        `sfdx force:data:soql:query --query SELECT NamespacePrefix FROM Organization LIMIT 1 --targetusername ${SESSION_ID} --json`
      );
      expect(command.description).to.equal(
        nls.localize(
          'isv_debug_bootstrap_step2_configure_project_retrieve_namespace'
        )
      );
    });

    it('Verify parseOrgNamespaceQueryResultJson', async () => {
      const forceProjectConfigBuilder = new IsvDebugBootstrapExecutor();
      expect(
        forceProjectConfigBuilder.parseOrgNamespaceQueryResultJson(
          '{"status":0,"result":{"totalSize":1,"done":true,"records":[{"attributes":{"type":"Organization","url":"/services/data/v42.0/sobjects/Organization/00D1F0000008gTUUAY"},"NamespacePrefix":null}]}}'
        )
      ).to.equal('');
      expect(
        forceProjectConfigBuilder.parseOrgNamespaceQueryResultJson(
          '{"status":0,"result":{"totalSize":1,"done":true,"records":[{"attributes":{"type":"Organization","url":"/services/data/v42.0/sobjects/Organization/00D1F0000008gTUUAY"},"NamespacePrefix":"abc"}]}}'
        )
      ).to.equal('abc');
    });

    it('Verify buildRetrieveOrgSourceCommand', async () => {
      const builder = new IsvDebugBootstrapExecutor();
      const command = builder.buildRetrieveOrgSourceCommand({
        loginUrl: LOGIN_URL,
        sessionId: SESSION_ID,
        projectName: PROJECT_NAME,
        projectUri: PROJECT_DIR[0].fsPath
      });
      expect(command.toCommand()).to.equal(
        `sfdx force:mdapi:retrieve --retrievetargetdir ${builder.relativeMetdataTempPath} --unpackaged ${builder.relativeApexPackageXmlPath} --targetusername ${SESSION_ID}`
      );
      expect(command.description).to.equal(
        nls.localize('isv_debug_bootstrap_step3_retrieve_org_source')
      );
    });

    it('Verify buildMetadataApiConvertOrgSourceCommand', async () => {
      const builder = new IsvDebugBootstrapExecutor();
      const command = builder.buildMetadataApiConvertOrgSourceCommand({
        loginUrl: LOGIN_URL,
        sessionId: SESSION_ID,
        projectName: PROJECT_NAME,
        projectUri: PROJECT_DIR[0].fsPath
      });
      expect(command.toCommand()).to.equal(
        `sfdx force:mdapi:convert --rootdir ${path.join(
          builder.relativeMetdataTempPath,
          'unpackaged'
        )} --outputdir force-app`
      );
      expect(command.description).to.equal(
        nls.localize('isv_debug_bootstrap_step4_convert_org_source')
      );
    });

    it('Verify buildPackageInstalledListAsJsonCommand', async () => {
      const builder = new IsvDebugBootstrapExecutor();
      const command = builder.buildPackageInstalledListAsJsonCommand({
        loginUrl: LOGIN_URL,
        sessionId: SESSION_ID,
        projectName: PROJECT_NAME,
        projectUri: PROJECT_DIR[0].fsPath
      });
      expect(command.toCommand()).to.equal(
        `sfdx force:package:installed:list --targetusername ${SESSION_ID} --json`
      );
      expect(command.description).to.equal(
        nls.localize('isv_debug_bootstrap_step5_list_installed_packages')
      );
    });

    it('Verify buildRetrievePackagesSourceCommand', async () => {
      const packageNames = ['mypackage_abc', 'mpackage_def'];
      const builder = new IsvDebugBootstrapExecutor();
      const command = builder.buildRetrievePackagesSourceCommand(
        {
          loginUrl: LOGIN_URL,
          sessionId: SESSION_ID,
          projectName: PROJECT_NAME,
          projectUri: PROJECT_DIR[0].fsPath
        },
        packageNames
      );
      expect(command.toCommand()).to.equal(
        `sfdx force:mdapi:retrieve --retrievetargetdir ${builder.relativeMetdataTempPath} --packagenames mypackage_abc,mpackage_def --targetusername ${SESSION_ID}`
      );
      expect(command.description).to.equal(
        nls.localize('isv_debug_bootstrap_step6_retrieve_packages_source')
      );
    });

    it('Verify buildMetadataApiConvertPackageSourceCommand', async () => {
      const packageName = 'mypackage_abc';
      const builder = new IsvDebugBootstrapExecutor();
      const command = builder.buildMetadataApiConvertPackageSourceCommand(
        packageName
      );
      expect(command.toCommand()).to.equal(
        `sfdx force:mdapi:convert --rootdir ${path.join(
          builder.relativeMetdataTempPath,
          'packages',
          packageName
        )} --outputdir ${path.join(
          builder.relativeInstalledPackagesPath,
          packageName
        )}`
      );
      expect(command.description).to.equal(
        nls.localize(
          'isv_debug_bootstrap_step7_convert_package_source',
          packageName
        )
      );
    });
  });

  describe('IsvDebugBootstrapExecutor execution', () => {
    let executor: IsvDebugBootstrapExecutor;
    let executeCommandSpy: sinon.SinonStub;
    let vscodeCommandSpy: sinon.SinonStub;
    const TEST_DATA_FOLDER = path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'test',
      'commands',
      'isvdebugger',
      'testdata'
    );

    beforeEach(() => {
      executor = new IsvDebugBootstrapExecutor();
      executeCommandSpy = sinon.stub(executor, 'executeCommand');
      vscodeCommandSpy = sinon.stub(vscode.commands, 'executeCommand');
    });

    afterEach(() => {
      executeCommandSpy.restore();
      vscodeCommandSpy.restore();
    });

    it('Should successfully pass through execution', async () => {
      const projectPath = path.join(PROJECT_DIR[0].fsPath, PROJECT_NAME);
      const projectMetadataTempPath = path.join(
        projectPath,
        executor.relativeMetdataTempPath
      );

      // fake namespace query
      executeCommandSpy
        .onCall(2)
        .returns(
          '{"status":0,"result":{"totalSize":1,"done":true,"records":[{"attributes":{"type":"Organization","url":"/services/data/v42.0/sobjects/Organization/00D1F0000008gTUUAY"},"NamespacePrefix":null}]}}'
        );

      // fake org source retrieval into unpackaged.zip
      executeCommandSpy.onCall(3).callsFake(() => {
        const zip = new AdmZip();
        zip.addLocalFolder(path.join(TEST_DATA_FOLDER, 'org-source'));
        zip.writeZip(path.join(projectMetadataTempPath, 'unpackaged.zip'));
      });

      // fake package list retrieval
      executeCommandSpy.onCall(5).returns(
        JSON.stringify({
          status: 0,
          result: [
            {
              Id: '0A3xx000000000bCAA',
              SubscriberPackageId: '033xx00000008cpAAA',
              SubscriberPackageName: 'mypackage',
              SubscriberPackageNamespace: 'developer',
              SubscriberPackageVersionId: '04txx000000079pAAA',
              SubscriberPackageVersionName: 'Third',
              SubscriberPackageVersionNumber: '1.3.0.1'
            }
          ]
        })
      );

      // fake package source retrieval into unpackaged.zip
      executeCommandSpy.onCall(6).callsFake(() => {
        const zip = new AdmZip();
        zip.addLocalFolder(path.join(TEST_DATA_FOLDER, 'packages-source'));
        zip.writeZip(path.join(projectMetadataTempPath, 'unpackaged.zip'));
      });

      const input = {
        type: 'CONTINUE',
        data: {
          loginUrl: LOGIN_URL,
          sessionId: SESSION_ID,
          projectName: PROJECT_NAME,
          projectUri: PROJECT_DIR[0].fsPath
        }
      } as ContinueResponse<IsvDebugBootstrapConfig>;
      await executor.execute(input);
      expect(executeCommandSpy.callCount).to.equal(8);
      expect(vscodeCommandSpy.callCount).to.equal(1);
    });
  });
});
