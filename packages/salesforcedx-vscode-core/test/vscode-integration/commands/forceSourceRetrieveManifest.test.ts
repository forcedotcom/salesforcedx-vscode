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
import { createSandbox, SinonStub } from 'sinon';
import { OUTPUT_CHANNEL } from '../../../src/channels';
import { ForceSourceRetrieveManifestExecutor } from '../../../src/commands';
import { LibrarySourceRetrieveManifestExecutor } from '../../../src/commands/forceSourceRetrieveManifest';
import { createRetrieveOutput } from '../../../src/commands/util';
import { workspaceContext } from '../../../src/context';
import { nls } from '../../../src/messages';
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
    const manifestPath = 'package.xml';
    const packageDirs = ['p1', 'p2'];
    const packageDirFullPaths = packageDirs.map(p =>
      path.join(getRootWorkspacePath(), p)
    );
    const mockComponents = new ComponentSet([
      { fullName: 'Test', type: 'apexclass' },
      { fullName: 'Test2', type: 'layout' }
    ]);

    let mockConnection: Connection;
    let retrieveStub: SinonStub;
    let outputStub: SinonStub;

    const executor = new LibrarySourceRetrieveManifestExecutor();

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
      env
        .stub(SfdxPackageDirectories, 'getDefaultPackageDir')
        .resolves(packageDirs[0]);
      env.stub(workspaceContext, 'getConnection').resolves(mockConnection);
      env
        .stub(ComponentSet, 'fromManifestFile')
        .withArgs(manifestPath, {
          resolve: packageDirFullPaths,
          literalWildcard: true
        })
        .returns(mockComponents);
      retrieveStub = env
        .stub(mockComponents, 'retrieve')
        .withArgs(mockConnection, packageDirFullPaths[0], { merge: true });
      outputStub = env.stub(OUTPUT_CHANNEL, 'appendLine');
    });

    afterEach(() => {
      env.restore();
      $$.SANDBOX.restore();
    });

    it('Should correctly report success', async () => {
      const retrieveResult = {
        success: true,
        failures: [],
        successes: [],
        status: RetrieveStatus.Succeeded
      };
      retrieveStub.resolves(retrieveResult);

      const success = await executor.run({
        data: manifestPath,
        type: 'CONTINUE'
      });

      expect(success).to.equal(true);
      expect(
        outputStub.calledWith(createRetrieveOutput(retrieveResult, packageDirs))
      );
    });

    it('Should correctly report failure', async () => {
      const retrieveResult = {
        success: false,
        failures: [],
        successes: [],
        status: RetrieveStatus.Failed
      };
      retrieveStub.resolves(retrieveResult);

      const success = await executor.run({
        data: manifestPath,
        type: 'CONTINUE'
      });

      expect(success).to.equal(false);
      expect(
        outputStub.calledWith(createRetrieveOutput(retrieveResult, packageDirs))
      );
    });
  });
});
