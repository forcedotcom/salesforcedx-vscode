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
import * as context from '../../src/context';

import { SfdxProjectJsonParser } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { channelService } from '../../src/channels';
import { nls } from '../../src/messages';
import { notificationService } from '../../src/notifications';
import {
  FileEventType,
  getPackageDirectoriesGlobString,
  pushOrDeploy
} from '../../src/settings';

const OrgType = context.OrgType;
/* tslint:disable:no-unused-expression */
describe('getPackageDirectoriesGlobString', () => {
  it('should return a glob string with one package directory', async () => {
    const getPackageDirectoriesStub = stub(
      SfdxProjectJsonParser.prototype,
      'getPackageDirectoryPaths'
    ).returns(['force-app']);

    const globString = await getPackageDirectoriesGlobString();

    expect(globString).to.include(path.join('{force-app}', '**'));
    getPackageDirectoriesStub.restore();
  });

  it('should return a glob string with multiple package directories', async () => {
    const getPackageDirectoriesStub = stub(
      SfdxProjectJsonParser.prototype,
      'getPackageDirectoryPaths'
    ).returns(['package1', 'package2', 'package3']);

    const globString = await getPackageDirectoriesGlobString();

    expect(globString).to.include(
      path.join('{package1,package2,package3}', '**')
    );
    getPackageDirectoriesStub.restore();
  });

  it('should throw an error if no package directories are found in the sfdx-project.json', async () => {
    const error = new Error();
    error.name = 'NoPackageDirectoriesFound';
    const getPackageDirectoriesStub = stub(
      SfdxProjectJsonParser.prototype,
      'getPackageDirectoryPaths'
    ).throws(error);
    let errorWasThrown = false;

    try {
      await getPackageDirectoriesGlobString();
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
      'getPackageDirectoryPaths'
    ).throws(error);
    let errorWasThrown = false;
    try {
      await getPackageDirectoriesGlobString();
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

      await pushOrDeploy(FileEventType.Create);

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

      await pushOrDeploy(FileEventType.Create);

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
    let getWorkspaceOrgTypeStub: SinonStub;
    let executeCommandStub: SinonStub;

    beforeEach(() => {
      getWorkspaceOrgTypeStub = stub(context, 'getWorkspaceOrgType').returns(
        OrgType.SourceTracked
      );
      executeCommandStub = stub(vscode.commands, 'executeCommand');
    });

    afterEach(() => {
      getWorkspaceOrgTypeStub.restore();
      executeCommandStub.restore();
    });

    const testPushOrDeployOn = async (fileEvent: FileEventType) => {
      await pushOrDeploy(fileEvent);

      expect(executeCommandStub.calledOnce).to.be.true;
      expect(executeCommandStub.getCall(0).args[0]).to.eql(
        'sfdx.force.source.push'
      );
      expect(showErrorMessageStub.calledOnce).to.be.false;
      expect(appendLineStub.calledOnce).to.be.false;
    };

    it('should call force:source:push on file creation', async () => {
      await testPushOrDeployOn(FileEventType.Create);
    });

    it('should call force:source:push on file change', async () => {
      await testPushOrDeployOn(FileEventType.Change);
    });

    it('should call force:source:push on file deletion', async () => {
      await testPushOrDeployOn(FileEventType.Delete);
    });
  });

  describe('orgs without sourceTracking', () => {
    let getWorkspaceOrgTypeStub: SinonStub;
    let executeCommandStub: SinonStub;
    beforeEach(() => {
      getWorkspaceOrgTypeStub = stub(context, 'getWorkspaceOrgType').returns(
        Promise.resolve(OrgType.NonSourceTracked)
      );
      executeCommandStub = stub(vscode.commands, 'executeCommand');
    });

    afterEach(() => {
      getWorkspaceOrgTypeStub.restore();
      executeCommandStub.restore();
    });

    it('should call force:source:deploy on multiple paths for file creations', async () => {
      await pushOrDeploy(FileEventType.Create, []);

      expect(executeCommandStub.calledOnce).to.be.true;
      expect(executeCommandStub.getCall(0).args[0]).to.eql(
        'sfdx.force.source.deploy.multiple.source.paths'
      );
      expect(showErrorMessageStub.calledOnce).to.be.false;
      expect(appendLineStub.calledOnce).to.be.false;
    });

    it('should call force:source:deploy on a single path for file changes', async () => {
      await pushOrDeploy(FileEventType.Change, []);

      expect(executeCommandStub.calledOnce).to.be.true;
      expect(executeCommandStub.getCall(0).args[0]).to.eql(
        'sfdx.force.source.deploy.source.path'
      );
      expect(showErrorMessageStub.calledOnce).to.be.false;
      expect(appendLineStub.calledOnce).to.be.false;
    });

    it('should display an error to the user for file deletions', async () => {
      await pushOrDeploy(FileEventType.Delete);

      const error = nls.localize(
        'error_deploy_delete_on_save_not_supported_text'
      );
      expect(executeCommandStub.called).to.be.false;
      expect(showErrorMessageStub.calledOnce).to.be.true;
      expect(showErrorMessageStub.getCall(0).args[0]).to.equal(error);
      expect(appendLineStub.calledOnce).to.be.true;
      expect(appendLineStub.getCall(0).args[0]).to.equal(error);
    });
  });
});
