/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { expect } from 'chai';
import * as path from 'path';
import { createSandbox, SinonStub } from 'sinon';
import { ForceSourceDeployManifestExecutor } from '../../../src/commands';
import { LibrarySourceDeployManifestExecutor } from '../../../src/commands/forceSourceDeployManifest';
import { workspaceContext } from '../../../src/context';
import { nls } from '../../../src/messages';
import { SfdxPackageDirectories } from '../../../src/sfdxProject';
import { getRootWorkspacePath } from '../../../src/util';

const env = createSandbox();
const $$ = testSetup();

describe('Force Source Deploy Using Manifest Option', () => {
  describe('CLI Executor', () => {
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
  });

  describe('Library Executor', () => {
    const manifestPath = 'package.xml';
    const packageDirs = ['p1', 'p2'];
    const mockComponents = new ComponentSet([
      { fullName: 'Test', type: 'apexclass' },
      { fullName: 'Test2', type: 'layout' }
    ]);

    let mockConnection: Connection;
    let deployStub: SinonStub;
    let startStub: SinonStub;

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
      env.stub(workspaceContext, 'getConnection').resolves(mockConnection);

      env
        .stub(SfdxPackageDirectories, 'getPackageDirectoryPaths')
        .resolves(packageDirs);
      env
        .stub(ComponentSet, 'fromManifestFile')
        .withArgs(manifestPath, {
          resolve: packageDirs.map(p => path.join(getRootWorkspacePath(), p))
        })
        .returns(mockComponents);
      startStub = env.stub();
      deployStub = env.stub(mockComponents, 'deploy').returns({
        start: startStub
      });
    });

    afterEach(() => {
      env.restore();
      $$.SANDBOX.restore();
    });

    it('should deploy components in a manifest', async () => {
      await executor.run({ data: manifestPath, type: 'CONTINUE' });

      expect(deployStub.calledOnce).to.equal(true);
      expect(deployStub.firstCall.args[0]).to.deep.equal({
        usernameOrConnection: mockConnection
      });
      expect(startStub.calledOnce).to.equal(true);
    });
  });
});
