/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import {
  instantiateContext,
  MockTestOrgData,
  restoreContext,
  stubContext
} from '@salesforce/core/lib/testSetup';
import { SourceTrackingService } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { expect } from 'chai';
import * as path from 'path';
import { SinonStub } from 'sinon';
import { LibrarySourceDeployManifestExecutor } from '../../../src/commands/forceSourceDeployManifest';
import { WorkspaceContext } from '../../../src/context';
import { SfdxPackageDirectories } from '../../../src/sfdxProject';
import { workspaceUtils } from '../../../src/util';

const $$ = instantiateContext();
const env = $$.SANDBOX;

describe('Force Source Deploy Using Manifest Option', () => {
  beforeEach(() => {
    stubContext($$);
  });

  afterEach(() => {
    restoreContext($$);
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
    let pollStatusStub: SinonStub;

    const executor = new LibrarySourceDeployManifestExecutor();

    beforeEach(async () => {
      const testData = new MockTestOrgData();
      $$.setConfigStubContents('AuthInfoConfig', {
        contents: await testData.getConfig()
      });
      mockConnection = await testData.getConnection();
      env
        .stub(WorkspaceContext.prototype, 'getConnection')
        .resolves(mockConnection);

      env
        .stub(SfdxPackageDirectories, 'getPackageDirectoryPaths')
        .resolves(packageDirs);

      env
        .stub(ComponentSet, 'fromManifest')
        .withArgs({
          manifestPath,
          resolveSourcePaths: packageDirs.map(p =>
            path.join(workspaceUtils.getRootWorkspacePath(), p)
          ),
          forceAddWildcards: undefined
        })
        .returns(mockComponents);

      pollStatusStub = env.stub();
      deployStub = env.stub(mockComponents, 'deploy').returns({
        pollStatus: pollStatusStub
      });
      env.stub(SourceTrackingService, 'createSourceTracking').resolves({
        ensureLocalTracking: async () => {}
      });
    });

    afterEach(() => {
      env.restore();
    });

    it('should deploy components in a manifest', async () => {
      await executor.run({ data: manifestPath, type: 'CONTINUE' });

      expect(deployStub.calledOnce).to.equal(true);
      expect(deployStub.firstCall.args[0]).to.deep.equal({
        usernameOrConnection: mockConnection
      });
      expect(pollStatusStub.calledOnce).to.equal(true);
    });
  });
});
