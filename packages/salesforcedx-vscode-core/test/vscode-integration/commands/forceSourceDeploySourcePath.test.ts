/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, ConfigAggregator, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import { ToolingApi } from '@salesforce/source-deploy-retrieve/lib/client';
import { MetadataApi } from '@salesforce/source-deploy-retrieve/lib/client/metadataApi';
import { expect } from 'chai';
import * as path from 'path';
import { createSandbox, SinonSandbox } from 'sinon';
import {
  ForceSourceDeploySourcePathExecutor,
  LibraryDeploySourcePathExecutor
} from '../../../src/commands';
import { nls } from '../../../src/messages';
import { SfdxProjectConfig } from '../../../src/sfdxProject';
import { OrgAuthInfo } from '../../../src/util';

describe('Force Source Deploy Using Sourcepath Option', () => {
  it('Should build the source deploy command for', () => {
    const sourcePath = path.join('path', 'to', 'sourceFile');
    const sourceDeploy = new ForceSourceDeploySourcePathExecutor();
    const sourceDeployCommand = sourceDeploy.build(sourcePath);

    expect(sourceDeployCommand.toCommand()).to.equal(
      `sfdx force:source:deploy --sourcepath ${sourcePath} --json --loglevel fatal`
    );
    expect(sourceDeployCommand.description).to.equal(
      nls.localize('force_source_deploy_text')
    );
  });

  describe('Source Deploy Beta', () => {
    // Setup the test environment.
    const $$ = testSetup();
    const testData = new MockTestOrgData();

    let mockConnection: Connection;
    let sb: SinonSandbox;

    beforeEach(async () => {
      sb = createSandbox();
      $$.setConfigStubContents('AuthInfoConfig', {
        contents: await testData.getConfig()
      });
      mockConnection = await Connection.create({
        authInfo: await AuthInfo.create({
          username: testData.username
        })
      });
      sb.stub(ConfigAggregator.prototype, 'getPropertyValue')
        .withArgs('defaultusername')
        .returns(testData.username);
    });

    afterEach(() => {
      $$.SANDBOX.restore();
      sb.restore();
    });

    it('should get the namespace value from sfdx-project.json and deploy using tooling API', async () => {
      sb.stub(OrgAuthInfo, 'getDefaultUsernameOrAlias').returns(
        testData.username
      );
      sb.stub(OrgAuthInfo, 'getConnection').returns(mockConnection);
      const getNamespace = sb
        .stub(SfdxProjectConfig, 'getValue')
        .returns('diFf');
      const getComponentsStub = sb.stub(
        RegistryAccess.prototype,
        'getComponentsFromPath'
      );
      const executor = new LibraryDeploySourcePathExecutor();
      const filePath = path.join(
        'test',
        'file',
        'path',
        'classes',
        'apexTest.cls'
      );
      const mockToolingDeploy = sb
        .stub(ToolingApi.prototype, `deploy`)
        .resolves('');
      await executor.execute({ type: 'CONTINUE', data: filePath });
      expect(mockToolingDeploy.calledOnce).to.equal(true);

      // tslint:disable-next-line:no-unused-expression
      expect(getComponentsStub.calledWith(filePath)).to.be.true;
      expect(getNamespace.calledOnce).to.equal(true);
      // NOTE: There's currently a limitation on source deploy retrieve that prevents
      // us from mocking SourceClient.tooling.deploy. We'll look into updating the library and this test.
    });

    it('should get the namespace value from sfdx-project.json and deploy using metadata API', async () => {
      sb.stub(OrgAuthInfo, 'getDefaultUsernameOrAlias').returns(
        testData.username
      );
      sb.stub(OrgAuthInfo, 'getConnection').returns(mockConnection);
      const getNamespace = sb.stub(SfdxProjectConfig, 'getValue').returns('');
      const getComponentsStub = sb.stub(
        RegistryAccess.prototype,
        'getComponentsFromPath'
      );
      const executor = new LibraryDeploySourcePathExecutor();
      const filePath = path.join(
        'test',
        'file',
        'path',
        'classes',
        'apexTest.cls'
      );
      const mockToolingDeploy = sb
        .stub(MetadataApi.prototype, `deploy`)
        .resolves('');
      await executor.execute({ type: 'CONTINUE', data: filePath });
      expect(mockToolingDeploy.calledOnce).to.equal(true);
      // tslint:disable-next-line:no-unused-expression
      expect(getComponentsStub.calledWith(filePath)).to.be.true;
      expect(getNamespace.calledOnce).to.equal(true);
    });
  });
});
