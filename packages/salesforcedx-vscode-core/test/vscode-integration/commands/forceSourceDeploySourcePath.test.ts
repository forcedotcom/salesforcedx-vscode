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
import { createSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { LibraryDeploySourcePathExecutor } from '../../../src/commands';
import * as forceSourceDeploySourcePath from '../../../src/commands/forceSourceDeploySourcePath';
import { TimestampConflictChecker } from '../../../src/commands/util/postconditionCheckers';
import { workspaceContext } from '../../../src/context';
import { SfdxPackageDirectories, SfdxProjectConfig } from '../../../src/sfdxProject';
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

      const authInfo = await AuthInfo.create({
        username: testData.username
      });

      mockConnection = await Connection.create({
        authInfo
      });

      getComponentsFromPathStub = sb
        .stub(MetadataResolver.prototype, 'getComponentsFromPath')
        .returns([]);

      sb.stub(workspaceContext, 'getConnection').resolves(mockConnection);
      sb.stub(workspaceContext, 'username').get(() => testData.username);

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

      await executor.run({
        type: 'CONTINUE',
        data: [filePath]
      });

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
      const filePath1 = path.join('classes', 'MyClass1.cls');
      const filePath2 = path.join('classes', 'MyClass2.cls');
      const filePath3 = path.join('lwc', 'myBundle', 'myBundle');

      await executor.run({
        type: 'CONTINUE',
        data: [
          filePath1,
          filePath2,
          filePath3
        ]
      });

      expect(getComponentsFromPathStub.calledThrice).to.equal(true);
      expect(getComponentsFromPathStub.firstCall.args[0]).to.equal(filePath1);
      expect(getComponentsFromPathStub.secondCall.args[0]).to.equal(filePath2);
      expect(getComponentsFromPathStub.thirdCall.args[0]).to.equal(filePath3);
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

    it('should deploy multiple files', async () => {
      const filePath1 = path.join('classes', 'MyClass1.cls');
      const filePath2 = path.join('classes', 'MyClass2.cls');
      const filePath3 = path.join('lwc', 'myBundle', 'myBundle');
      const uris = [
        vscode.Uri.file(filePath1),
        vscode.Uri.file(filePath2),
        vscode.Uri.file(filePath3)
      ];
      const filePaths = uris.map(uri => {
        return uri.fsPath;
      });
      const timestampConflictCheckerCheckStub = sb
        .stub(TimestampConflictChecker.prototype, 'check')
        .returns({
          type: 'CONTINUE',
          data: filePaths
        });
      const isInPackageDirectoryStub = sb
        .stub(SfdxPackageDirectories, 'isInPackageDirectory')
        .returns(true);

      await forceSourceDeploySourcePath.forceSourceDeploySourcePaths(
        uris[0],
        uris
      );

      expect(timestampConflictCheckerCheckStub.called).to.equal(true);
      const continueResponse = timestampConflictCheckerCheckStub.args[0][0] as ContinueResponse<string[]>;
      expect(JSON.stringify(continueResponse.data)).to.equal(JSON.stringify(filePaths));
    });

    it('should deploy a single file', async () => {
      const filePath1 = path.join('classes', 'MyClass1.cls');
      const uris = [
        vscode.Uri.file(filePath1)
      ];
      const filePaths = uris.map(uri => {
        return uri.fsPath;
      });
      const timestampConflictCheckerCheckStub = sb
        .stub(TimestampConflictChecker.prototype, 'check')
        .returns({
          type: 'CONTINUE',
          data: filePaths
        });
      const isInPackageDirectoryStub = sb
        .stub(SfdxPackageDirectories, 'isInPackageDirectory')
        .returns(true);

      await forceSourceDeploySourcePath.forceSourceDeploySourcePaths(
        uris[0],
        uris
      );

      expect(timestampConflictCheckerCheckStub.called).to.equal(true);
      const continueResponse = timestampConflictCheckerCheckStub.args[0][0] as ContinueResponse<string[]>;
      expect(JSON.stringify(continueResponse.data)).to.equal(JSON.stringify(filePaths));
    });

    it('should deploy when editing single file and "Deploy This Source from Org" is executed', async () => {
      const filePath1 = path.join('classes', 'MyClass1.cls');
      const uris = [
        vscode.Uri.file(filePath1)
      ];
      const filePaths = uris.map(uri => {
        return uri.fsPath;
      });
      const timestampConflictCheckerCheckStub = sb
        .stub(TimestampConflictChecker.prototype, 'check')
        .returns({
          type: 'CONTINUE',
          data: filePaths
        });
      const isInPackageDirectoryStub = sb
        .stub(SfdxPackageDirectories, 'isInPackageDirectory')
        .returns(true);

      await forceSourceDeploySourcePath.forceSourceDeploySourcePaths(
        uris[0],
        undefined
      );

      expect(timestampConflictCheckerCheckStub.called).to.equal(true);
      const continueResponse = timestampConflictCheckerCheckStub.args[0][0] as ContinueResponse<string[]>;
      expect(JSON.stringify(continueResponse.data)).to.equal(JSON.stringify(filePaths));
    });

    it('should deploy when using the command palette', async () => {
      const filePath1 = path.join('classes', 'MyClass1.cls');

      // When deploying via the command palette,
      // sourceUri is undefined, and uris is undefined as well,
      // and the path is obtained from the active editor
      // (and calling getUriFromActiveEditor())
      const sourceUri = undefined;
      const uris = undefined;

      const filePaths = [ filePath1 ];
      const timestampConflictCheckerCheckStub = sb
        .stub(TimestampConflictChecker.prototype, 'check')
        .returns({
          type: 'CONTINUE',
          data: filePaths
        });
      const isInPackageDirectoryStub = sb
        .stub(SfdxPackageDirectories, 'isInPackageDirectory')
        .returns(true);

      const getUriFromActiveEditorStub = sb
        .stub(forceSourceDeploySourcePath, 'getUriFromActiveEditor')
        .returns(filePath1);

      await forceSourceDeploySourcePath.forceSourceDeploySourcePaths(
        sourceUri,
        uris
      );

      expect(getUriFromActiveEditorStub.called).to.equal(true);
    });

    it('should deploy when saving and the "salesforcedx-vscode-core.push-or-deploy-on-save" setting is on', async () => {
      const filePath1 = path.join('classes', 'MyClass1.cls');

      // When the push-or-deploy-on-save setting is on,
      // sourceUri is an array, and uris is undefined.
      const sourceUri: vscode.Uri[] = [
        vscode.Uri.file(filePath1)
      ];
      const uris = undefined;

      const filePaths = sourceUri.map(uri => {
        return uri.fsPath;
      });
      const timestampConflictCheckerCheckStub = sb
        .stub(TimestampConflictChecker.prototype, 'check')
        .returns({
          type: 'CONTINUE',
          data: filePaths
        });
      const isInPackageDirectoryStub = sb
        .stub(SfdxPackageDirectories, 'isInPackageDirectory')
        .returns(true);

      await forceSourceDeploySourcePath.forceSourceDeploySourcePaths(
        sourceUri,
        uris
      );

      expect(timestampConflictCheckerCheckStub.called).to.equal(true);
      const continueResponse = timestampConflictCheckerCheckStub.args[0][0] as ContinueResponse<string[]>;
      expect(JSON.stringify(continueResponse.data)).to.equal(JSON.stringify(filePaths));
    });
  });
});
