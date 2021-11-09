/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types/index';
import {
  ComponentSet,
  MetadataResolver
} from '@salesforce/source-deploy-retrieve';
import { expect } from 'chai';
import * as path from 'path';
import * as vscode from 'vscode';
import { createSandbox, SinonStub } from 'sinon';
import { LibraryDeploySourcePathExecutor } from '../../../src/commands';
import * as forceSourceDeploySourcePath from '../../../src/commands/forceSourceDeploySourcePath';
import { workspaceContext } from '../../../src/context';
import { SfdxProjectConfig } from '../../../src/sfdxProject';
import { getRootWorkspacePath } from '../../../src/util';

const sb = createSandbox();
const $$ = testSetup();

describe('Force Source Deploy Using Sourcepath Option', () => {
  describe('Library Executor', () => {
    let mockConnection: Connection;

    let getComponentsFromPathStub: SinonStub;
    let pollStatusStub: SinonStub;
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

      getComponentsFromPathStub = sb
        .stub(MetadataResolver.prototype, 'getComponentsFromPath')
        .returns([]);
      sb.stub(workspaceContext, 'getConnection').resolves(mockConnection);
      pollStatusStub = sb.stub().resolves(undefined);
      deployStub = sb
        .stub(ComponentSet.prototype, 'deploy')
        .withArgs({ usernameOrConnection: mockConnection })
        .returns({
          pollStatus: pollStatusStub
        });

      sb.stub(SfdxProjectConfig, 'getValue').resolves('11.0');
    });

    afterEach(() => {
      sb.restore();
    });

    it('should deploy with a single path', async () => {
      const filePath = path.join('classes', 'MyClass.cls');
      const executor = new LibraryDeploySourcePathExecutor();

      await executor.run({ data: filePath, type: 'CONTINUE' });

      expect(getComponentsFromPathStub.calledOnce).to.equal(true);
      expect(getComponentsFromPathStub.firstCall.args[0]).to.equal(filePath);
      expect(deployStub.calledOnce).to.equal(true);
      expect(deployStub.firstCall.args[0]).to.deep.equal({
        usernameOrConnection: mockConnection
      });
      expect(pollStatusStub.calledOnce).to.equal(true);
    });

    it('should deploy with multiple paths', async () => {
      const executor = new LibraryDeploySourcePathExecutor();
      const filePath1 = path.join('classes', 'MyClass.cls');
      const filePath2 = path.join('lwc', 'myBundle', 'myBundle');

      await executor.run({ data: [filePath1, filePath2], type: 'CONTINUE' });

      expect(getComponentsFromPathStub.calledTwice).to.equal(true);
      expect(getComponentsFromPathStub.firstCall.args[0]).to.equal(filePath1);
      expect(getComponentsFromPathStub.secondCall.args[0]).to.equal(filePath2);
      expect(deployStub.calledOnce).to.equal(true);
      expect(deployStub.firstCall.args[0]).to.deep.equal({
        usernameOrConnection: mockConnection
      });
      expect(pollStatusStub.calledOnce).to.equal(true);
    });

    it('componentSet should have sourceApiVersion set', async () => {
      const executor = new LibraryDeploySourcePathExecutor();
      const data = path.join(
        getRootWorkspacePath(),
        'force-app/main/default/classes/'
      );
      const continueResponse = {
        type: 'CONTINUE',
        data: [data]
      } as ContinueResponse<string[]>;
      const componentSet = executor.getComponents(continueResponse);
      expect((await componentSet).sourceApiVersion).to.equal('11.0');
    });

    it('verifies forceSourceDeployMultipleSourcePaths() is called when multiple files are deployed', async () => {
      const forceSourceDeployMultipleSourcePathsStub = sb.stub(
        forceSourceDeploySourcePath,
        'forceSourceDeployMultipleSourcePaths'
      );

      const uris = [
        vscode.Uri.file('/path/to/Class1.cls'),
        vscode.Uri.file('/path/to/Class2.cls')
      ];
      await forceSourceDeploySourcePath.forceSourceDeploySourcePath(
        uris[0],
        uris
      );

      expect(forceSourceDeployMultipleSourcePathsStub.callCount).to.equal(1);
      expect(
        forceSourceDeployMultipleSourcePathsStub.firstCall.args[0]
      ).to.equal(uris);
    });

    it('verifies forceSourceDeploySingleSourcePath() is not called when multiple files are deployed', async () => {
      const forceSourceDeployMultipleSourcePathsStub = sb.stub(
        forceSourceDeploySourcePath,
        'forceSourceDeployMultipleSourcePaths'
      );
      const forceSourceDeploySingleSourcePathSpy = sb.spy(
        forceSourceDeploySourcePath,
        'forceSourceDeploySingleSourcePath'
      );

      const uris = [
        vscode.Uri.file('/path/to/Class1.cls'),
        vscode.Uri.file('/path/to/Class2.cls')
      ];
      await forceSourceDeploySourcePath.forceSourceDeploySourcePath(
        uris[0],
        uris
      );

      expect(forceSourceDeploySingleSourcePathSpy.called).to.equal(false);
    });

    it('verifies forceSourceDeploySingleSourcePath() is called when a single file is deployed', async () => {
      const forceSourceDeploySingleSourcePathStub = sb.stub(
        forceSourceDeploySourcePath,
        'forceSourceDeploySingleSourcePath'
      );

      const uri = vscode.Uri.file('/path/to/Class.cls');
      await forceSourceDeploySourcePath.forceSourceDeploySourcePath(uri, [uri]);

      expect(forceSourceDeploySingleSourcePathStub.callCount).to.equal(1);
      expect(forceSourceDeploySingleSourcePathStub.firstCall.args[0]).to.equal(
        uri
      );
    });

    it('verifies forceSourceDeployMultipleSourcePaths() is not called when a single file is deployed', async () => {
      const forceSourceDeploySingleSourcePathStub = sb.stub(
        forceSourceDeploySourcePath,
        'forceSourceDeploySingleSourcePath'
      );
      const forceSourceDeployMultipleSourcePathsSpy = sb.spy(
        forceSourceDeploySourcePath,
        'forceSourceDeployMultipleSourcePaths'
      );

      const uri = vscode.Uri.file('/path/to/Class.cls');
      await forceSourceDeploySourcePath.forceSourceDeploySourcePath(uri, [uri]);

      expect(forceSourceDeployMultipleSourcePathsSpy.called).to.equal(false);
    });
  });
});
