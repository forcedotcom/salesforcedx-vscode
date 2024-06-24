/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core-bundle';
import {
  instantiateContext,
  MockTestOrgData,
  restoreContext,
  stubContext
} from '@salesforce/core-bundle';
import { SourceTrackingService } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve-bundle';
import { expect } from 'chai';
import * as path from 'path';
import { SinonStub } from 'sinon';
import { LibraryDeployManifestExecutor } from '../../../src/commands/deployManifest';
import { WorkspaceContext } from '../../../src/context';
import { SalesforcePackageDirectories } from '../../../src/salesforceProject';
import { workspaceUtils } from '../../../src/util';

const $$ = instantiateContext();
const env = $$.SANDBOX;

describe('Deploy Using Manifest Option', () => {
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

    const executor = new LibraryDeployManifestExecutor();

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
        .stub(SalesforcePackageDirectories, 'getPackageDirectoryPaths')
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
      env.stub(SourceTrackingService, 'getSourceTracking').resolves({
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
