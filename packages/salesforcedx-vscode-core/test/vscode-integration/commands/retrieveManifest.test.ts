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
} from '@salesforce/core/testSetup';
import { SourceTrackingService } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { expect } from 'chai';
import * as path from 'path';
import { SinonStub } from 'sinon';
import { LibraryRetrieveManifestExecutor } from '../../../src/commands/retrieveManifest';
import { WorkspaceContext } from '../../../src/context';
import { SalesforcePackageDirectories } from '../../../src/salesforceProject';
import { workspaceUtils } from '../../../src/util';

const $$ = instantiateContext();
const env = $$.SANDBOX;

describe('Retrieve with Manifest Option', () => {
  beforeEach(() => {
    env.stub(SourceTrackingService, 'getSourceTracking');
    env.stub(SourceTrackingService, 'updateSourceTrackingAfterRetrieve');
  });
  afterEach(() => {
    restoreContext($$);
  });

  describe('Library Executor', () => {
    const manifestPath = 'package.xml';
    const packageDirs = ['p1', 'p2'];
    const packageDirFullPaths = packageDirs.map(p =>
      path.join(workspaceUtils.getRootWorkspacePath(), p)
    );
    const defaultPackagePath = packageDirFullPaths[0];
    const mockComponents = new ComponentSet([
      { fullName: 'Test', type: 'apexclass' },
      { fullName: 'Test2', type: 'layout' }
    ]);

    let mockConnection: Connection;
    let retrieveStub: SinonStub;
    let pollStatusStub: SinonStub;

    const executor = new LibraryRetrieveManifestExecutor();

    beforeEach(async () => {
      const testData = new MockTestOrgData();
      stubContext($$);
      $$.setConfigStubContents('AuthInfoConfig', {
        contents: await testData.getConfig()
      });
      mockConnection = await testData.getConnection();

      env
        .stub(SalesforcePackageDirectories, 'getPackageDirectoryPaths')
        .resolves(packageDirs);
      env
        .stub(SalesforcePackageDirectories, 'getDefaultPackageDir')
        .resolves(packageDirs[0]);
      env
        .stub(WorkspaceContext.prototype, 'getConnection')
        .resolves(mockConnection);
      env
        .stub(ComponentSet, 'fromManifest')
        .withArgs({
          manifestPath,
          resolveSourcePaths: packageDirFullPaths,
          forceAddWildcards: true
        })
        .returns(mockComponents);
      pollStatusStub = env.stub();
      retrieveStub = env.stub(mockComponents, 'retrieve').returns({
        pollStatus: pollStatusStub
      });
    });

    it('should retrieve components in a manifest', async () => {
      await executor.run({ data: manifestPath, type: 'CONTINUE' });

      expect(retrieveStub.calledOnce).to.equal(true);
      expect(retrieveStub.firstCall.args[0]).to.deep.equal({
        usernameOrConnection: mockConnection,
        output: defaultPackagePath,
        merge: true,
        suppressEvents: false
      });
      expect(pollStatusStub.calledOnce).to.equal(true);
    });
  });
});
