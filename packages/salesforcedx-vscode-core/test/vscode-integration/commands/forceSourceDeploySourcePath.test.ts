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
import {
  ForceSourceDeploySourcePathExecutor,
  LibraryDeploySourcePathExecutor
} from '../../../src/commands';
import { workspaceContext } from '../../../src/context';
import { nls } from '../../../src/messages';

const sb = createSandbox();
const $$ = testSetup();

describe('Force Source Deploy Using Sourcepath Option', () => {
  describe('CLI Executor', () => {
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
  });

  describe('Library Executor', () => {
    let mockConnection: Connection;

    let resolveStub: SinonStub;
    let getConnectionStub: SinonStub;
    let startStub: SinonStub;
    let deployStub: SinonStub;

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
      resolveStub = sb.stub(ComponentSet.prototype, 'resolveSourceComponents');
      getConnectionStub = sb
        .stub(workspaceContext, 'getConnection')
        .resolves(mockConnection);
      startStub = sb.stub().resolves(undefined);
      deployStub = sb
        .stub(ComponentSet.prototype, 'deploy')
        .withArgs({ usernameOrConnection: mockConnection })
        .returns({
          start: startStub
        });
    });

    afterEach(() => {
      sb.restore();
    });

    it('should deploy with a single path', async () => {
      const filePath = path.join('classes', 'MyClass.cls');
      const executor = new LibraryDeploySourcePathExecutor();

      await executor.run({ data: filePath, type: 'CONTINUE' });

      expect(resolveStub.calledOnce).to.equal(true);
      expect(resolveStub.firstCall.args[0]).to.equal(filePath);
      expect(deployStub.calledOnce).to.equal(true);
      expect(deployStub.firstCall.args[0]).to.deep.equal({
        usernameOrConnection: mockConnection
      });
      expect(startStub.calledOnce).to.equal(true);
    });

    it('should deploy with multiple paths', async () => {
      const executor = new LibraryDeploySourcePathExecutor();
      const filePath1 = path.join('classes', 'MyClass.cls');
      const filePath2 = path.join('lwc', 'myBundle', 'myBundle');

      await executor.run({ data: [filePath1, filePath2], type: 'CONTINUE' });

      expect(resolveStub.calledTwice).to.equal(true);
      expect(resolveStub.firstCall.args[0]).to.equal(filePath1);
      expect(resolveStub.secondCall.args[0]).to.equal(filePath2);
      expect(deployStub.calledOnce).to.equal(true);
      expect(deployStub.firstCall.args[0]).to.deep.equal({
        usernameOrConnection: mockConnection
      });
      expect(startStub.calledOnce).to.equal(true);
    });
  });
});
