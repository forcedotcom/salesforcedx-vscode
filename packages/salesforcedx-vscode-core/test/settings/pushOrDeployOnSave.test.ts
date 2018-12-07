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

import { SfdxProject } from '@salesforce/core';
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
    const sfdxProjectStub = stub(SfdxProject, 'resolve').returns(
      Promise.resolve({
        resolveProjectConfig: () => ({
          packageDirectories: [{ path: 'force-app' }]
        })
      })
    );
    const globString = await getPackageDirectoriesGlobString();
    expect(globString).to.include(path.join('{force-app}', '**'));
    sfdxProjectStub.restore();
  });

  it('should return a glob string with multiple package directories', async () => {
    const sfdxProjectStub = stub(SfdxProject, 'resolve').returns(
      Promise.resolve({
        resolveProjectConfig: () => ({
          packageDirectories: [
            { path: 'package1' },
            { path: 'package2' },
            { path: 'package3' }
          ]
        })
      })
    );
    const globString = await getPackageDirectoriesGlobString();
    expect(globString).to.include(
      path.join('{package1,package2,package3}', '**')
    );
    sfdxProjectStub.restore();
  });

  it('should throw an error if no package directories are found in the sfdx-project.json', async () => {
    const sfdxProjectStub = stub(SfdxProject, 'resolve').returns(
      Promise.resolve({ resolveProjectConfig: () => ({}) })
    );
    let errorWasThrown = false;
    try {
      await getPackageDirectoriesGlobString();
    } catch (error) {
      errorWasThrown = true;
      expect(error.message).to.equal(
        nls.localize('error_no_package_directories_found_text')
      );
    } finally {
      expect(errorWasThrown).to.be.true;
      sfdxProjectStub.restore();
    }
  });

  it('should throw an error if packageDirectories does not specify any paths', async () => {
    const sfdxProjectStub = stub(SfdxProject, 'resolve').returns(
      Promise.resolve({
        resolveProjectConfig: () => ({ packageDirectories: [] })
      })
    );
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
      sfdxProjectStub.restore();
    }
  });
});

describe('pushOrDeploy', () => {
  describe('when it is not possible to determine the org type', () => {
    it('should display an error to the user when the defaultusername org info cannot be found', async () => {
      const namedOrgNotFoundError = new Error();
      namedOrgNotFoundError.name = 'NamedOrgNotFound';
      const getWorkspaceOrgTypeStub = stub(
        context,
        'getWorkspaceOrgType'
      ).throws(namedOrgNotFoundError);
      const showErrorMessageStub = stub(
        notificationService,
        'showErrorMessage'
      );
      const appendLineStub = stub(channelService, 'appendLine');

      await pushOrDeploy(FileEventType.Create);

      expect(showErrorMessageStub.calledOnce).to.be.true;
      expect(appendLineStub.calledOnce).to.be.true;
      getWorkspaceOrgTypeStub.restore();
      showErrorMessageStub.restore();
      appendLineStub.restore();
    });

    it('should display an error to the user when no defaultusername is set', async () => {
      const noDefaultUsernameSetError = new Error();
      noDefaultUsernameSetError.name = 'NoDefaultusernameSet';
      const getWorkspaceOrgTypeStub = stub(
        context,
        'getWorkspaceOrgType'
      ).throws(noDefaultUsernameSetError);
      const showErrorMessageStub = stub(
        notificationService,
        'showErrorMessage'
      );
      const appendLineStub = stub(channelService, 'appendLine');

      await pushOrDeploy(FileEventType.Create);

      expect(showErrorMessageStub.calledOnce).to.be.true;
      expect(appendLineStub.calledOnce).to.be.true;
      getWorkspaceOrgTypeStub.restore();
      showErrorMessageStub.restore();
      appendLineStub.restore();
    });
  });

  describe('orgs with sourceTracking', () => {
    let getWorkspaceOrgTypeStub: SinonStub;
    let showErrorMessageStub: SinonStub;
    let appendLineStub: SinonStub;
    let executeCommandStub: SinonStub;

    beforeEach(() => {
      getWorkspaceOrgTypeStub = stub(context, 'getWorkspaceOrgType').returns(
        OrgType.SourceTracked
      );
      showErrorMessageStub = stub(notificationService, 'showErrorMessage');
      appendLineStub = stub(channelService, 'appendLine');
      executeCommandStub = stub(vscode.commands, 'executeCommand');
    });

    afterEach(() => {
      getWorkspaceOrgTypeStub.restore();
      showErrorMessageStub.restore();
      appendLineStub.restore();
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
    let showErrorMessageStub: SinonStub;
    let appendLineStub: SinonStub;
    let executeCommandStub: SinonStub;
    beforeEach(() => {
      getWorkspaceOrgTypeStub = stub(context, 'getWorkspaceOrgType').returns(
        Promise.resolve(OrgType.NonSourceTracked)
      );
      showErrorMessageStub = stub(notificationService, 'showErrorMessage');
      appendLineStub = stub(channelService, 'appendLine');
      executeCommandStub = stub(vscode.commands, 'executeCommand');
    });

    afterEach(() => {
      getWorkspaceOrgTypeStub.restore();
      showErrorMessageStub.restore();
      appendLineStub.restore();
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
        'sfdx.force.source.deploy.manifest.or.source.path'
      );
      expect(showErrorMessageStub.calledOnce).to.be.false;
      expect(appendLineStub.calledOnce).to.be.false;
    });

    it('should display an error to the user for file deletions', async () => {
      await pushOrDeploy(FileEventType.Delete);

      expect(executeCommandStub.called).to.be.false;
      expect(showErrorMessageStub.calledOnce).to.be.true;
      expect(appendLineStub.calledOnce).to.be.true;
    });
  });
});
