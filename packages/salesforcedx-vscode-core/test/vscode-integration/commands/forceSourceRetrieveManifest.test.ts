/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { RetrieveStatus } from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import { expect } from 'chai';
import * as path from 'path';
import { createSandbox, createStubInstance } from 'sinon';
import { ForceSourceRetrieveManifestExecutor } from '../../../src/commands';
import { LibrarySourceRetrieveManifestExecutor } from '../../../src/commands/forceSourceRetrieveManifest';
import { workspaceContext } from '../../../src/context';
import { nls } from '../../../src/messages';
import { notificationService } from '../../../src/notifications';
import { SfdxPackageDirectories } from '../../../src/sfdxProject';
import { getRootWorkspacePath } from '../../../src/util';

const env = createSandbox();
const $$ = testSetup();

describe('Force Source Retrieve with Manifest Option', () => {
  it('Should build the source retrieve command', () => {
    const manifestPath = path.join('path', 'to', 'manifest', 'package.xml');
    const sourceRetrieve = new ForceSourceRetrieveManifestExecutor();
    const sourceRetrieveCommand = sourceRetrieve.build(manifestPath);
    expect(sourceRetrieveCommand.toCommand()).to.equal(
      `sfdx force:source:retrieve --manifest ${manifestPath}`
    );
    expect(sourceRetrieveCommand.description).to.equal(
      nls.localize('force_source_retrieve_text')
    );
  });

  describe('Library Beta', () => {
    const testData = new MockTestOrgData();
    const executor = new LibrarySourceRetrieveManifestExecutor();

    let mockConnection: Connection;

    beforeEach(async () => {
      $$.setConfigStubContents('AuthInfoConfig', {
        contents: await testData.getConfig()
      });
      mockConnection = await Connection.create({
        authInfo: await AuthInfo.create({
          username: testData.username
        })
      });
    });

    afterEach(() => env.restore());

    it('Should retrieve using manifest file', async () => {
      const manifestPath = 'package.xml';
      const packageDirs = ['package1', 'package2'];
      const packageDirFullPaths = packageDirs.map(p => path.join(getRootWorkspacePath(), p));
      const mockComponents = new ComponentSet([{ fullName: 'Test', type: 'apexclass'}, {fullName: 'Test2', type: 'layout' }]);

      env.stub(SfdxPackageDirectories, 'getPackageDirectoryFullPaths').resolves(packageDirFullPaths);
      env.stub(SfdxPackageDirectories, 'getDefaultPackageDir').resolves(packageDirs[0]);
      env.stub(workspaceContext, 'getConnection').resolves(mockConnection);
      env.stub(ComponentSet, 'fromManifestFile')
        .withArgs(manifestPath, { resolve: packageDirFullPaths, literalWildcard: true })
        .returns(mockComponents);
      env
        .stub(mockComponents, 'retrieve')
        .withArgs(mockConnection.getUsername()!, packageDirFullPaths[0], { merge: true })
        .resolves({
          success: true,
          failures: [],
          successes: [],
          status: RetrieveStatus.Succeeded
        });
      const notificationSpy = env.spy(notificationService, 'showSuccessfulExecution');

      await executor.execute({ data: manifestPath, type: 'CONTINUE' });

      expect(notificationSpy.calledOnce).to.equal(true);
    });
  });
});
