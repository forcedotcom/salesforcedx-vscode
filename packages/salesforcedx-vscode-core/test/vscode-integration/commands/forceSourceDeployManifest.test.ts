/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import {
  ComponentSet,
  DeployStatus,
  SourceDeployResult
} from '@salesforce/source-deploy-retrieve';
import { expect } from 'chai';
import * as path from 'path';
import { createSandbox, SinonStub } from 'sinon';
import { channelService } from '../../../src/channels';

import { ForceSourceDeployManifestExecutor } from '../../../src/commands';
import { LibrarySourceDeployManifestExecutor } from '../../../src/commands/forceSourceDeployManifest';
import { LibraryDeployResultParser } from '../../../src/commands/util';
import { outputDeployTable } from '../../../src/commands/util/libraryDeployResultParser';
import { workspaceContext } from '../../../src/context';

import { nls } from '../../../src/messages';
import { notificationService } from '../../../src/notifications';
import { SfdxPackageDirectories } from '../../../src/sfdxProject';
import { getRootWorkspacePath } from '../../../src/util';

const env = createSandbox();
const $$ = testSetup();

describe('Force Source Deploy Using Manifest Option', () => {
  it('Should build the source deploy command', () => {
    const manifestPath = path.join('path', 'to', 'manifest', 'package.xml');
    const sourceDeploy = new ForceSourceDeployManifestExecutor();
    const sourceDeployCommand = sourceDeploy.build(manifestPath);
    expect(sourceDeployCommand.toCommand()).to.equal(
      `sfdx force:source:deploy --manifest ${manifestPath} --json --loglevel fatal`
    );
    expect(sourceDeployCommand.description).to.equal(
      nls.localize('force_source_deploy_text')
    );
  });

  describe('Library Beta', () => {
    const manifestPath = 'package.xml';
    const packageDirs = ['p1', 'p2'];
    // const packageDirFullPaths = packageDirs.map(p =>
    //   path.join(getRootWorkspacePath(), p)
    // );
    const mockComponents = new ComponentSet([
      { fullName: 'Test', type: 'apexclass' },
      { fullName: 'Test2', type: 'layout' }
    ]);

    let mockConnection: Connection;
    let deployStub: SinonStub;

    const executor = new LibrarySourceDeployManifestExecutor();

    beforeEach(async () => {
      const testData = new MockTestOrgData();
      $$.setConfigStubContents('AuthInfoConfig', {
        contents: await testData.getConfig()
      });
      mockConnection = await Connection.create({
        authInfo: await AuthInfo.create({
          username: testData.username
        })
      });

      env
        .stub(SfdxPackageDirectories, 'getPackageDirectoryPaths')
        .resolves(packageDirs);
      env.stub(workspaceContext, 'getConnection').resolves(mockConnection);
      env
        .stub(ComponentSet, 'fromManifestFile')
        .withArgs(manifestPath, {
          resolve: packageDirs.map(p => path.join(getRootWorkspacePath(), p))
        })
        .returns(mockComponents);
      deployStub = env.stub(mockComponents, 'deploy').withArgs(mockConnection);
    });

    afterEach(() => {
      env.restore();
      $$.SANDBOX.restore();
    });

    it('Should correctly report success', async () => {
      const deployResult: SourceDeployResult = {
        id: 'abcd',
        status: DeployStatus.Succeeded,
        success: true,
        components: []
      };
      deployStub.resolves(deployResult);
      const notificationStub = env.stub(
        notificationService,
        'showSuccessfulExecution'
      );
      const channelServiceStub = env.stub(channelService, 'appendLine');

      await executor.execute({ data: manifestPath, type: 'CONTINUE' });

      expect(notificationStub.calledOnce).to.equal(true);
      expect(
        channelServiceStub.calledWith(
          outputDeployTable(deployResult, packageDirs)
        )
      );
    });

    it('Should correctly report failure', async () => {
      const deployResult: SourceDeployResult = {
        id: 'abcd',
        status: DeployStatus.Failed,
        success: true,
        components: []
      };
      deployStub.resolves(deployResult);
      const notificationStub = env.stub(
        notificationService,
        'showFailedExecution'
      );
      const channelServiceStub = env.stub(channelService, 'appendLine');

      await executor.execute({ data: manifestPath, type: 'CONTINUE' });

      expect(notificationStub.calledOnce).to.equal(true);
      expect(
        channelServiceStub.calledWith(
          outputDeployTable(deployResult, packageDirs)
        )
      );
    });
  });
});
