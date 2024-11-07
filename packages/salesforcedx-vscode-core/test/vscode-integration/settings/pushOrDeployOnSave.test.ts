/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { createSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { channelService } from '../../../src/channels';
import { workspaceContextUtils } from '../../../src/context';
import { nls } from '../../../src/messages';
import { notificationService } from '../../../src/notifications';
import { SalesforcePackageDirectories } from '../../../src/salesforceProject';
import { DeployQueue, fileShouldNotBeDeployed, pathIsInPackageDirectory } from '../../../src/settings';
import { SalesforceCoreSettings } from '../../../src/settings/salesforceCoreSettings';
import { telemetryService } from '../../../src/telemetry';

/* tslint:disable:no-unused-expression */

const sandbox = createSandbox();
const OrgType = workspaceContextUtils.OrgType;

describe('Push or Deploy on Save', () => {
  let appendLineStub: SinonStub;
  let showErrorMessageStub: SinonStub;
  beforeEach(() => {
    appendLineStub = sandbox.stub(channelService, 'appendLine');
    showErrorMessageStub = sandbox.stub(notificationService, 'showErrorMessage');
  });

  afterEach(() => sandbox.restore());

  describe('pathIsInPackageDirectory', () => {
    it('should return true if the path is in a package directory', async () => {
      sandbox.stub(SalesforcePackageDirectories, 'isInPackageDirectory').returns(true);
      const isInPackageDirectory = await pathIsInPackageDirectory('test-path');
      expect(isInPackageDirectory).to.be.true;
      expect(appendLineStub.called).to.be.false;
      expect(showErrorMessageStub.called).to.be.false;
    });

    it('should return false if the path is not in a package directory', async () => {
      sandbox.stub(SalesforcePackageDirectories, 'isInPackageDirectory').returns(false);
      const isInPackageDirectory = await pathIsInPackageDirectory('test-path');
      expect(isInPackageDirectory).to.be.false;
      expect(appendLineStub.called).to.be.false;
      expect(showErrorMessageStub.called).to.be.false;
    });

    it('should throw an error if no package directories are found in the sfdx-project.json', async () => {
      const error = new Error();
      error.name = 'NoPackageDirectoriesFound';
      sandbox.stub(SalesforcePackageDirectories, 'isInPackageDirectory').throws(error);
      let errorWasThrown = false;

      try {
        await pathIsInPackageDirectory('test-path');
      } catch (e) {
        errorWasThrown = true;
        expect(e.message).to.equal(nls.localize('error_no_package_directories_found_on_setup_text'));
      } finally {
        expect(errorWasThrown).to.be.true;
        expect(appendLineStub.called).to.be.true;
        expect(showErrorMessageStub.called).to.be.true;
      }
    });

    it('should throw an error if packageDirectories does not specify any paths', async () => {
      const error = new Error();
      error.name = 'NoPackageDirectoryPathsFound';
      sandbox.stub(SalesforcePackageDirectories, 'isInPackageDirectory').throws(error);
      let errorWasThrown = false;
      try {
        await pathIsInPackageDirectory('test-path');
      } catch (err) {
        errorWasThrown = true;
        expect(err.message).to.equal(nls.localize('error_no_package_directories_paths_found_text'));
      } finally {
        expect(errorWasThrown).to.be.true;
        expect(appendLineStub.called).to.be.true;
        expect(showErrorMessageStub.called).to.be.true;
      }
    });
  });

  describe('DeployQueue', () => {
    let getWorkspaceOrgTypeStub: SinonStub;
    let executeCommandStub: SinonStub;

    beforeEach(() => {
      DeployQueue.reset();
      getWorkspaceOrgTypeStub = sandbox.stub(workspaceContextUtils, 'getWorkspaceOrgType');
      executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');
      sandbox.stub(SalesforceCoreSettings.prototype, 'getPreferDeployOnSaveEnabled').returns(false);
    });

    it('should not deploy if nothing has been queued', async () => {
      await DeployQueue.get().unlock();
      expect(executeCommandStub.notCalled).to.be.true;
    });

    it('should stop additional files from deploying until queue is unlocked', async () => {
      getWorkspaceOrgTypeStub.resolves(OrgType.NonSourceTracked);
      const telemetryStub = sandbox.stub(telemetryService, 'sendEventData');
      const queue = DeployQueue.get();

      // start a deploy from an enqueue and lock deploys
      expect(executeCommandStub.notCalled).to.be.true;
      let uris = [vscode.Uri.file('/sample')];
      await queue.enqueue(uris[0]);
      expect(executeCommandStub.calledOnce).to.be.true;
      expect(
        telemetryStub.calledWith(
          'deployOnSave',
          { deployType: 'Deploy' },
          { documentsToDeploy: 1, waitTimeForLastDeploy: 0 }
        )
      ).to.be.true;

      // try enquing more files and deploying
      uris = [vscode.Uri.file('/sample2'), vscode.Uri.file('/sample3')];
      await queue.enqueue(uris[0]);
      await queue.enqueue(uris[1]);
      expect(executeCommandStub.calledTwice).to.be.false;
      expect(telemetryStub.calledTwice).to.be.false;

      // signal to the queue we're done and deploy anything that has been queued while locked
      await queue.unlock();
      expect(executeCommandStub.callCount).to.equal(3);
      expect(executeCommandStub.getCall(1).args[1]).to.eql([uris[0]]);

      const telemArgs = telemetryStub.getCall(1).args;
      expect(telemArgs[0]).to.equal('deployOnSave');
      expect(telemArgs[1]).to.deep.equal({ deployType: 'Deploy' });
      expect(telemArgs[2]['documentsToDeploy']).to.equal(1);
      expect(telemArgs[2]['waitTimeForLastDeploy'] > 0).to.be.false;
    });

    it('should display an error to the user when the target-org org info cannot be found', async () => {
      const namedOrgNotFoundError = new Error();
      namedOrgNotFoundError.name = 'NamedOrgNotFound';
      getWorkspaceOrgTypeStub.throws(namedOrgNotFoundError);

      await DeployQueue.get().enqueue(vscode.Uri.file('/sample'));

      const error = nls.localize('error_fetching_auth_info_text');
      expect(showErrorMessageStub.calledOnce).to.be.true;
      expect(showErrorMessageStub.getCall(0).args[0]).to.equal(error);
      expect(appendLineStub.calledOnce).to.be.true;
      expect(appendLineStub.getCall(0).args[0]).to.equal(error);
    });

    it('should display an error to the user when no target-org is set', async () => {
      const noTargetOrgSetError = new Error();
      noTargetOrgSetError.name = 'NoTargetOrgSet';
      getWorkspaceOrgTypeStub.throws(noTargetOrgSetError);

      await DeployQueue.get().enqueue(vscode.Uri.file('/sample'));

      const error = nls.localize('error_push_or_deploy_on_save_no_target_org');
      expect(showErrorMessageStub.calledOnce).to.be.true;
      expect(showErrorMessageStub.getCall(0).args[0]).to.equal(error);
      expect(appendLineStub.calledOnce).to.be.true;
      expect(appendLineStub.getCall(0).args[0]).to.equal(error);
    });

    it('should call project:deploy:start when getPushOrDeployOnSaveIgnoreConflicts is false', async () => {
      getWorkspaceOrgTypeStub.resolves(OrgType.SourceTracked);
      sandbox.stub(SalesforceCoreSettings.prototype, 'getPushOrDeployOnSaveIgnoreConflicts').returns(false);

      await DeployQueue.get().enqueue(vscode.Uri.file('/sample'));

      expect(executeCommandStub.calledOnce).to.be.true;
      expect(executeCommandStub.getCall(0).args[0]).to.eql('sf.project.deploy.start');
      expect(showErrorMessageStub.calledOnce).to.be.false;
      expect(appendLineStub.calledOnce).to.be.false;
    });

    it('should call project:deploy:start --ignore-conflicts when getPushOrDeployOnSaveIgnoreConflicts is true', async () => {
      getWorkspaceOrgTypeStub.resolves(OrgType.SourceTracked);
      sandbox.stub(SalesforceCoreSettings.prototype, 'getPushOrDeployOnSaveIgnoreConflicts').returns(true);

      await DeployQueue.get().enqueue(vscode.Uri.file('/sample'));

      expect(executeCommandStub.calledOnce).to.be.true;
      expect(executeCommandStub.getCall(0).args[0]).to.eql('sf.project.deploy.start.ignore.conflicts');
      expect(showErrorMessageStub.calledOnce).to.be.false;
      expect(appendLineStub.calledOnce).to.be.false;
    });

    it('should call deploy on multiple paths', async () => {
      getWorkspaceOrgTypeStub.resolves(OrgType.NonSourceTracked);

      await DeployQueue.get().enqueue(vscode.Uri.file('/sample'));

      expect(executeCommandStub.calledOnce).to.be.true;
      expect(executeCommandStub.getCall(0).args[0]).to.eql('sf.deploy.multiple.source.paths');
      expect(showErrorMessageStub.calledOnce).to.be.false;
      expect(appendLineStub.calledOnce).to.be.false;
    });
  });

  describe('fileShouldNotBeDeployed', () => {
    // verify which types of files we want to be deployed on save

    it('should return true for dot files', async () => {
      const stopDotFileFromBeingDeployed = fileShouldNotBeDeployed('/force-app/main/default/.env');
      expect(stopDotFileFromBeingDeployed).to.be.true;
    });
    it('should return true for soql files', async () => {
      const stopSOQLFileFromBeingDeployed = fileShouldNotBeDeployed('/force-app/main/default/AccountQuery.soql');
      expect(stopSOQLFileFromBeingDeployed).to.be.true;
    });
    it('should return true for anonymous apex files', async () => {
      const stopAnonApexFileFromBeingDeployed = fileShouldNotBeDeployed('/force-app/main/default/GetAccounts.apex');
      expect(stopAnonApexFileFromBeingDeployed).to.be.true;
    });
    it('should return false for class files', async () => {
      const stopClassFileFromBeingDeployed = fileShouldNotBeDeployed('/force-app/main/default/MyAccountMap.cls');
      expect(stopClassFileFromBeingDeployed).to.be.false;
    });
  });
});
