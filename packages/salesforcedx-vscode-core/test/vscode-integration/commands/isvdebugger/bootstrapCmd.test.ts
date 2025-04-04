/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  EnterForceIdeUri,
  IsvDebugBootstrapConfig,
  IsvDebugBootstrapExecutor
} from '../../../../src/commands/isvdebugging';
import { projectTemplateEnum } from '../../../../src/commands/projectGenerate';
import { nls } from '../../../../src/messages';
import { workspaceUtils } from '../../../../src/util';

describe('ISV Debugging Project Bootstrap Command', () => {
  const LOGIN_URL = 'a.b.c';
  const SESSION_ID = '0x123';
  const PROJECT_NAME = 'sfdx-simple-clone';
  const ORIGINAL_PROJECT = 'sfdx-simple';
  const WORKSPACE_PATH = path.join(workspaceUtils.getRootWorkspacePath(), '..');
  const PROJECT_DIR: vscode.Uri[] = [vscode.Uri.parse(WORKSPACE_PATH)];

  describe('EnterForceIdeUri Gatherer', () => {
    let inputBoxSpy: sinon.SinonStub;
    let showErrorMessageSpy: sinon.SinonStub;

    beforeEach(() => {
      inputBoxSpy = sinon.stub(vscode.window, 'showInputBox');
      inputBoxSpy.onCall(0).returns(undefined);
      inputBoxSpy.onCall(1).returns('');
      inputBoxSpy.onCall(2).returns(`forceide://abc?url=${LOGIN_URL}&sessionId=${SESSION_ID}`);
      inputBoxSpy.onCall(3).returns(`forceide://abc?url=${LOGIN_URL}`);
      inputBoxSpy.onCall(4).returns(`forceide://abc?sessionId=${SESSION_ID}`);
      inputBoxSpy.onCall(5).returns(`forceide://abc?url=${LOGIN_URL}&sessionId=${SESSION_ID}`);
      inputBoxSpy.onCall(6).returns(`forceide://abc?url=${LOGIN_URL}&secure=0&sessionId=${SESSION_ID}`);
      showErrorMessageSpy = sinon.stub(vscode.window, 'showErrorMessage');
    });

    afterEach(() => {
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

    it('Should accept valid URI', async () => {
      const response = EnterForceIdeUri.uriValidator(`forceide://abc?url=${LOGIN_URL}&sessionId=${SESSION_ID}`);
      expect(response).to.be.null;
    });

    it('Should complain about invalid URI', async () => {
      expect(EnterForceIdeUri.uriValidator(`forceide://abc?url=${LOGIN_URL}&missingSessionId`)).to.equal(
        nls.localize('parameter_gatherer_invalid_forceide_url')
      );
      expect(EnterForceIdeUri.uriValidator(`forceide://abc?sessionId=${SESSION_ID}&missingUrl`)).to.equal(
        nls.localize('parameter_gatherer_invalid_forceide_url')
      );
      expect(EnterForceIdeUri.uriValidator('forceide://abc?url=&missingSessionId')).to.equal(
        nls.localize('parameter_gatherer_invalid_forceide_url')
      );
      expect(EnterForceIdeUri.uriValidator('totaly-bogus')).to.equal(
        nls.localize('parameter_gatherer_invalid_forceide_url')
      );
    });
  });

  describe('CLI Builder', () => {
    it('Verify buildCreateProjectCommand', async () => {
      const projectGenerateBuilder = new IsvDebugBootstrapExecutor();
      const createCommand = projectGenerateBuilder.buildCreateProjectCommand({
        loginUrl: LOGIN_URL,
        sessionId: SESSION_ID,
        orgName: PROJECT_NAME,
        projectName: PROJECT_NAME,
        projectUri: PROJECT_DIR[0].fsPath,
        projectTemplate: projectTemplateEnum.standard
      });
      expect(createCommand.toCommand()).to.equal(
        `sf project:generate --name ${PROJECT_NAME} --output-dir ${PROJECT_DIR[0].fsPath} --template standard`
      );
      expect(createCommand.description).to.equal(nls.localize('isv_debug_bootstrap_create_project'));
    });

    it('Verify buildConfigureProjectCommand', async () => {
      const forceProjectConfigBuilder = new IsvDebugBootstrapExecutor();
      const configureCommand = forceProjectConfigBuilder.buildConfigureProjectCommand({
        loginUrl: LOGIN_URL,
        sessionId: SESSION_ID,
        orgName: PROJECT_NAME,
        projectName: PROJECT_NAME,
        projectUri: PROJECT_DIR[0].fsPath,
        projectTemplate: projectTemplateEnum.standard
      });
      expect(configureCommand.toCommand()).to.equal(
        `sf config:set org-isv-debugger-sid=${SESSION_ID} org-isv-debugger-url=${LOGIN_URL} org-instance-url=${LOGIN_URL}`
      );
      expect(configureCommand.description).to.equal(nls.localize('isv_debug_bootstrap_configure_project'));
    });

    it('Verify buildQueryForOrgNamespacePrefixCommand', async () => {
      const forceProjectConfigBuilder = new IsvDebugBootstrapExecutor();
      const command = forceProjectConfigBuilder.buildQueryForOrgNamespacePrefixCommand({
        loginUrl: LOGIN_URL,
        sessionId: SESSION_ID,
        orgName: PROJECT_NAME,
        projectName: PROJECT_NAME,
        projectUri: PROJECT_DIR[0].fsPath,
        projectTemplate: projectTemplateEnum.standard
      });
      expect(command.toCommand()).to.equal(
        `sf data:query --query SELECT NamespacePrefix FROM Organization LIMIT 1 --target-org ${SESSION_ID} --json`
      );
      expect(command.description).to.equal(nls.localize('isv_debug_bootstrap_configure_project_retrieve_namespace'));
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
        orgName: PROJECT_NAME,
        projectName: PROJECT_NAME,
        projectUri: PROJECT_DIR[0].fsPath,
        projectTemplate: 'standard'
      });
      expect(command.toCommand()).to.equal(
        `sf project:retrieve:start --manifest ${builder.relativeApexPackageXmlPath} --target-org ${SESSION_ID}`
      );
      expect(command.description).to.equal(nls.localize('isv_debug_bootstrap_retrieve_org_source'));
    });

    it('Verify buildPackageInstalledListAsJsonCommand', async () => {
      const builder = new IsvDebugBootstrapExecutor();
      const command = builder.buildPackageInstalledListAsJsonCommand({
        loginUrl: LOGIN_URL,
        sessionId: SESSION_ID,
        orgName: PROJECT_NAME,
        projectName: PROJECT_NAME,
        projectUri: PROJECT_DIR[0].fsPath,
        projectTemplate: projectTemplateEnum.standard
      });
      expect(command.toCommand()).to.equal(`sf package:installed:list --target-org ${SESSION_ID} --json`);
      expect(command.description).to.equal(nls.localize('isv_debug_bootstrap_list_installed_packages'));
    });

    it('Verify buildRetrievePackageSourceCommand', async () => {
      const packageName = 'mypackage_abc_mpackage_def';
      const builder = new IsvDebugBootstrapExecutor();
      const command = builder.buildRetrievePackageSourceCommand(
        {
          loginUrl: LOGIN_URL,
          sessionId: SESSION_ID,
          orgName: PROJECT_NAME,
          projectName: PROJECT_NAME,
          projectUri: PROJECT_DIR[0].fsPath,
          projectTemplate: projectTemplateEnum.standard
        },
        packageName
      );
      expect(command.toCommand()).to.equal(
        `sf project:retrieve:start --package-name ${packageName} --target-org ${SESSION_ID} --target-metadata-dir ${builder.relativeInstalledPackagesPath} --unzip --zip-file-name ${packageName}`
      );
      expect(command.description).to.equal(nls.localize('isv_debug_bootstrap_retrieve_package_source', packageName));
    });

    it('Verify build does nothing', async () => {
      const builder = new IsvDebugBootstrapExecutor();
      expect(builder.build.bind(builder, {})).to.throw('not in use');
    });
  });

  describe('IsvDebugBootstrapExecutor execution', () => {
    let executor: IsvDebugBootstrapExecutor;
    let executeCommandSpy: sinon.SinonStub;
    let vscodeCommandSpy: sinon.SinonStub;

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
      const projectMetadataTempPath = path.join(projectPath, executor.relativeMetadataTempPath);
      const projectInstalledPackagesPath = path.join(projectPath, executor.relativeInstalledPackagesPath);

      // Setup old project data that should not be present upon completion
      await fs.promises.mkdir(path.join(projectInstalledPackagesPath, 'old-package'), { recursive: true });
      // fake project setup - copy the original project into this clone
      executeCommandSpy.onCall(0).callsFake(() => {
        fs.cpSync(path.join(PROJECT_DIR[0].fsPath, ORIGINAL_PROJECT), projectPath, { recursive: true });
      });

      // fake namespace query
      executeCommandSpy
        .onCall(2)
        .returns(
          '{"status":0,"result":{"totalSize":1,"done":true,"records":[{"attributes":{"type":"Organization","url":"/services/data/v42.0/sobjects/Organization/00D1F0000008gTUUAY"},"NamespacePrefix":null}]}}'
        );

      // fake package list retrieval
      executeCommandSpy.onCall(4).returns(
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

      // fake package metadata convert
      executeCommandSpy.onCall(5).callsFake(() => {
        fs.mkdirSync(path.join(projectInstalledPackagesPath, 'mypackage'), { recursive: true });
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
      expect(executeCommandSpy.callCount).to.equal(6);
      expect(vscodeCommandSpy.callCount).to.equal(1);

      // there should be a launch config
      expect(
        fs.existsSync(path.join(projectPath, '.vscode', 'launch.json')),
        'there must be a launch.json file'
      ).to.equal(true);

      // 'mypackage' should be an installed package
      expect(
        fs.existsSync(path.join(projectInstalledPackagesPath, 'mypackage')),
        'installed packages folder should be present'
      ).to.equal(true);

      // there should be only one package in the installed-packages folder
      const dirInfo = fs.readdirSync(projectInstalledPackagesPath);
      expect(dirInfo.length, `There should only be one package installed at ${projectInstalledPackagesPath}`).to.equal(
        1
      );

      // any temp files should be gone
      expect(fs.existsSync(projectMetadataTempPath), `folder ${projectMetadataTempPath} must be deleted`).to.equal(
        false
      );

      // Clean up project
      await fs.promises.rm(projectPath, { recursive: true, force: true });
    });
  });
});
