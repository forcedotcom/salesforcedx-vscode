/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
import { channelService } from '../../../src/channels';
import * as context from '../../../src/context';
import { nls } from '../../../src/messages';
import { notificationService } from '../../../src/notifications';
import { DeployQueue, pathIsInPackageDirectory } from '../../../src/settings';
import { SfdxPackageDirectories } from '../../../src/sfdxProject';
import { telemetryService } from '../../../src/telemetry';

const OrgType = context.OrgType;
/* tslint:disable:no-unused-expression */

describe('Push or Deploy on Save', () => {
  let appendLineStub: SinonStub;
  let showErrorMessageStub: SinonStub;
  beforeEach(() => {
    appendLineStub = stub(channelService, 'appendLine');
    showErrorMessageStub = stub(notificationService, 'showErrorMessage');
  });

  afterEach(() => {
    appendLineStub.restore();
    showErrorMessageStub.restore();
  });
  describe('pathIsInPackageDirectory', () => {
    it('should return true if the path is in a package directory', async () => {
      const isInPackageDirectoryStub = stub(
        SfdxPackageDirectories,
        'isInPackageDirectory'
      ).returns(true);
      const isInPackageDirectory = await pathIsInPackageDirectory(
        vscode.Uri.file('test-path')
      );
      expect(isInPackageDirectory).to.be.true;
      expect(appendLineStub.called).to.be.false;
      expect(showErrorMessageStub.called).to.be.false;
      isInPackageDirectoryStub.restore();
    });

    it('should return false if the path is not in a package directory', async () => {
      const isInPackageDirectoryStub = stub(
        SfdxPackageDirectories,
        'isInPackageDirectory'
      ).returns(false);
      const isInPackageDirectory = await pathIsInPackageDirectory(
        vscode.Uri.file('test-path')
      );
      expect(isInPackageDirectory).to.be.false;
      expect(appendLineStub.called).to.be.false;
      expect(showErrorMessageStub.called).to.be.false;
      isInPackageDirectoryStub.restore();
    });

    it('should throw an error if no package directories are found in the sfdx-project.json', async () => {
      const error = new Error();
      error.name = 'NoPackageDirectoriesFound';
      const isInPackageDirectoryStub = stub(
        SfdxPackageDirectories,
        'isInPackageDirectory'
      ).throws(error);
      let errorWasThrown = false;

      try {
        await pathIsInPackageDirectory(vscode.Uri.file('test-path'));
      } catch (e) {
        errorWasThrown = true;
        expect(e.message).to.equal(
          nls.localize('error_no_package_directories_found_on_setup_text')
        );
      } finally {
        expect(errorWasThrown).to.be.true;
        expect(appendLineStub.called).to.be.true;
        expect(showErrorMessageStub.called).to.be.true;
        isInPackageDirectoryStub.restore();
      }
    });

    it('should throw an error if packageDirectories does not specify any paths', async () => {
      const error = new Error();
      error.name = 'NoPackageDirectoryPathsFound';
      const isInPackageDirectoryStub = stub(
        SfdxPackageDirectories,
        'isInPackageDirectory'
      ).throws(error);
      let errorWasThrown = false;
      try {
        await pathIsInPackageDirectory(vscode.Uri.file('test-path'));
      } catch (error) {
        errorWasThrown = true;
        expect(error.message).to.equal(
          nls.localize('error_no_package_directories_paths_found_text')
        );
      } finally {
        expect(errorWasThrown).to.be.true;
        expect(appendLineStub.called).to.be.true;
        expect(showErrorMessageStub.called).to.be.true;
        isInPackageDirectoryStub.restore();
      }
    });
  });

  describe('DeployQueue', () => {
    let getWorkspaceOrgTypeStub: SinonStub;
    let executeCommandStub: SinonStub;

    beforeEach(() => {
      DeployQueue.reset();
      getWorkspaceOrgTypeStub = stub(context, 'getWorkspaceOrgType');
      executeCommandStub = stub(vscode.commands, 'executeCommand');
    });

    afterEach(() => {
      getWorkspaceOrgTypeStub.restore();
      executeCommandStub.restore();
    });

    it('should not deploy if nothing has been queued', async () => {
      await DeployQueue.get().unlock();
      expect(executeCommandStub.notCalled).to.be.true;
    });

    it('should stop additional files from deploying until queue is unlocked', async () => {
      getWorkspaceOrgTypeStub.resolves(OrgType.NonSourceTracked);
      const telemetryStub = stub(telemetryService, 'sendEventData');
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
      expect(executeCommandStub.calledTwice).to.be.true;
      expect(executeCommandStub.getCall(1).args[1]).to.eql(uris);

      const telemArgs = telemetryStub.getCall(1).args;
      expect(telemArgs[0]).to.equal('deployOnSave');
      expect(telemArgs[1]).to.deep.equal({ deployType: 'Deploy' });
      expect(telemArgs[2]['documentsToDeploy']).to.equal(2);
      expect(telemArgs[2]['waitTimeForLastDeploy'] > 0).to.be.true;

      telemetryStub.restore();
    });

    it('should display an error to the user when the defaultusername org info cannot be found', async () => {
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

    it('should display an error to the user when no defaultusername is set', async () => {
      const noDefaultUsernameSetError = new Error();
      noDefaultUsernameSetError.name = 'NoDefaultusernameSet';
      getWorkspaceOrgTypeStub.throws(noDefaultUsernameSetError);

      await DeployQueue.get().enqueue(vscode.Uri.file('/sample'));

      const error = nls.localize(
        'error_push_or_deploy_on_save_no_default_username'
      );
      expect(showErrorMessageStub.calledOnce).to.be.true;
      expect(showErrorMessageStub.getCall(0).args[0]).to.equal(error);
      expect(appendLineStub.calledOnce).to.be.true;
      expect(appendLineStub.getCall(0).args[0]).to.equal(error);
    });

    it('should call force:source:push', async () => {
      getWorkspaceOrgTypeStub.resolves(OrgType.SourceTracked);

      await DeployQueue.get().enqueue(vscode.Uri.file('/sample'));

      expect(executeCommandStub.calledOnce).to.be.true;
      expect(executeCommandStub.getCall(0).args[0]).to.eql(
        'sfdx.force.source.push'
      );
      expect(showErrorMessageStub.calledOnce).to.be.false;
      expect(appendLineStub.calledOnce).to.be.false;
      executeCommandStub.restore();
    });

    it('should call force:source:deploy on multiple paths', async () => {
      getWorkspaceOrgTypeStub.resolves(OrgType.NonSourceTracked);

      await DeployQueue.get().enqueue(vscode.Uri.file('/sample'));

      expect(executeCommandStub.calledOnce).to.be.true;
      expect(executeCommandStub.getCall(0).args[0]).to.eql(
        'sfdx.force.source.deploy.multiple.source.paths'
      );
      expect(showErrorMessageStub.calledOnce).to.be.false;
      expect(appendLineStub.calledOnce).to.be.false;
    });
  });
});
