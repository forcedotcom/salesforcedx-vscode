/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import * as path from 'path';
import { SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
import * as context from '../../../src/context';

import { channelService } from '../../../src/channels';
import { nls } from '../../../src/messages';
import { notificationService } from '../../../src/notifications';
import {
  getPackageDirectoryPaths,
  pushOrDeploy
} from '../../../src/settings/pushOrDeployOnSave';
import { SfdxProjectJsonParser } from '../../../src/util';

const OrgType = context.OrgType;
/* tslint:disable:no-unused-expression */
describe('getPackageDirectoryPaths', () => {
  it('should throw an error if no package directories are found in the sfdx-project.json', async () => {
    const error = new Error();
    error.name = 'NoPackageDirectoriesFound';
    const getPackageDirectoriesStub = stub(
      SfdxProjectJsonParser.prototype,
      'getPackageDirectoryFullPaths'
    ).throws(error);
    let errorWasThrown = false;

    try {
      await getPackageDirectoryPaths();
    } catch (e) {
      errorWasThrown = true;
      expect(e.message).to.equal(
        nls.localize('error_no_package_directories_found_text')
      );
    } finally {
      expect(errorWasThrown).to.be.true;
      getPackageDirectoriesStub.restore();
    }
  });

  it('should throw an error if packageDirectories does not specify any paths', async () => {
    const error = new Error();
    error.name = 'NoPackageDirectoryPathsFound';
    const getPackageDirectoriesStub = stub(
      SfdxProjectJsonParser.prototype,
      'getPackageDirectoryFullPaths'
    ).throws(error);
    let errorWasThrown = false;
    try {
      await getPackageDirectoryPaths();
    } catch (error) {
      errorWasThrown = true;
      expect(error.message).to.equal(
        nls.localize('error_no_package_directories_paths_found_text')
      );
    } finally {
      expect(errorWasThrown).to.be.true;
      getPackageDirectoriesStub.restore();
    }
  });
});

describe('pushOrDeploy', () => {
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
  describe('when it is not possible to determine the org type', () => {
    it('should display an error to the user when the defaultusername org info cannot be found', async () => {
      const namedOrgNotFoundError = new Error();
      namedOrgNotFoundError.name = 'NamedOrgNotFound';
      const getWorkspaceOrgTypeStub = stub(
        context,
        'getWorkspaceOrgType'
      ).throws(namedOrgNotFoundError);

      await pushOrDeploy([]);

      const error = nls.localize('error_fetching_auth_info_text');
      expect(showErrorMessageStub.calledOnce).to.be.true;
      expect(showErrorMessageStub.getCall(0).args[0]).to.equal(error);
      expect(appendLineStub.calledOnce).to.be.true;
      expect(appendLineStub.getCall(0).args[0]).to.equal(error);
      getWorkspaceOrgTypeStub.restore();
    });

    it('should display an error to the user when no defaultusername is set', async () => {
      const noDefaultUsernameSetError = new Error();
      noDefaultUsernameSetError.name = 'NoDefaultusernameSet';
      const getWorkspaceOrgTypeStub = stub(
        context,
        'getWorkspaceOrgType'
      ).throws(noDefaultUsernameSetError);

      await pushOrDeploy([]);

      const error = nls.localize(
        'error_push_or_deploy_on_save_no_default_username'
      );
      expect(showErrorMessageStub.calledOnce).to.be.true;
      expect(showErrorMessageStub.getCall(0).args[0]).to.equal(error);
      expect(appendLineStub.calledOnce).to.be.true;
      expect(appendLineStub.getCall(0).args[0]).to.equal(error);
      getWorkspaceOrgTypeStub.restore();
    });
  });

  describe('orgs with sourceTracking', () => {
    it('should call force:source:push', async () => {
      const getWorkspaceOrgTypeStub = stub(
        context,
        'getWorkspaceOrgType'
      ).returns(OrgType.SourceTracked);
      const executeCommandStub = stub(vscode.commands, 'executeCommand');

      await pushOrDeploy([]);

      expect(executeCommandStub.calledOnce).to.be.true;
      expect(executeCommandStub.getCall(0).args[0]).to.eql(
        'sfdx.force.source.push'
      );
      expect(showErrorMessageStub.calledOnce).to.be.false;
      expect(appendLineStub.calledOnce).to.be.false;

      getWorkspaceOrgTypeStub.restore();
      executeCommandStub.restore();
    });
  });

  describe('orgs without sourceTracking', () => {
    it('should call force:source:deploy on multiple paths', async () => {
      const getWorkspaceOrgTypeStub = stub(
        context,
        'getWorkspaceOrgType'
      ).returns(Promise.resolve(OrgType.NonSourceTracked));
      const executeCommandStub = stub(vscode.commands, 'executeCommand');

      await pushOrDeploy([]);

      expect(executeCommandStub.calledOnce).to.be.true;
      expect(executeCommandStub.getCall(0).args[0]).to.eql(
        'sfdx.force.source.deploy.multiple.source.paths'
      );
      expect(showErrorMessageStub.calledOnce).to.be.false;
      expect(appendLineStub.calledOnce).to.be.false;

      getWorkspaceOrgTypeStub.restore();
      executeCommandStub.restore();
    });
  });
});
