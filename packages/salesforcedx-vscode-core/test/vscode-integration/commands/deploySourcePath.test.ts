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
import {
  ContinueResponse,
  fileUtils,
  SourceTrackingService
} from '@salesforce/salesforcedx-utils-vscode';
import {
  ComponentSet,
  MetadataResolver
} from '@salesforce/source-deploy-retrieve-bundle';
import { expect } from 'chai';
import * as path from 'path';
import { SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { LibraryDeploySourcePathExecutor } from '../../../src/commands';
import * as deploySourcePath from '../../../src/commands/deploySourcePath';
import { TimestampConflictChecker } from '../../../src/commands/util/timestampConflictChecker';
import { WorkspaceContext } from '../../../src/context';
import {
  SalesforcePackageDirectories,
  SalesforceProjectConfig
} from '../../../src/salesforceProject';
import { workspaceUtils } from '../../../src/util';

const $$ = instantiateContext();
const sb = $$.SANDBOX;

describe('Deploy Using Sourcepath Option', () => {
  afterEach(() => {
    restoreContext($$);
  });

  describe('Library Executor', () => {
    let mockConnection: Connection;

    let getComponentsFromPathStub: SinonStub;
    let pollStatusStub: SinonStub;
    let deployStub: SinonStub;

    beforeEach(async () => {
      const testData = new MockTestOrgData();
      stubContext($$);
      $$.setConfigStubContents('AuthInfoConfig', {
        contents: await testData.getConfig()
      });

      mockConnection = await testData.getConnection();

      getComponentsFromPathStub = sb
        .stub(MetadataResolver.prototype, 'getComponentsFromPath')
        .returns([]);

      sb.stub(WorkspaceContext.prototype, 'getConnection').resolves(
        mockConnection
      );
      sb.stub(WorkspaceContext.prototype, 'username').get(
        () => testData.username
      );

      pollStatusStub = sb.stub().resolves(undefined);
      deployStub = sb
        .stub(ComponentSet.prototype, 'deploy')
        .withArgs({ usernameOrConnection: mockConnection })
        .returns({
          pollStatus: pollStatusStub
        });

      sb.stub(SalesforceProjectConfig, 'getValue').resolves('11.0');
      sb.stub(SourceTrackingService, 'getSourceTracking').resolves({
        ensureLocalTracking: async () => {}
      });
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
        data: [filePath1, filePath2, filePath3]
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
        .stub(SalesforcePackageDirectories, 'isInPackageDirectory')
        .returns(true);

      const flushFilePathsStub = sb
        .stub(fileUtils, 'flushFilePaths')
        .returns([
          path.sep + filePath1,
          path.sep + filePath2,
          path.sep + filePath3
        ]);

      await deploySourcePath.deploySourcePaths(uris[0], uris);

      expect(timestampConflictCheckerCheckStub.called).to.equal(true);
      const continueResponse = timestampConflictCheckerCheckStub
        .args[0][0] as ContinueResponse<string[]>;
      expect(JSON.stringify(continueResponse.data)).to.equal(
        JSON.stringify(filePaths)
      );

      flushFilePathsStub.restore();
      isInPackageDirectoryStub.restore();
    });

    it('should deploy a single file', async () => {
      const filePath1 = path.join('classes', 'MyClass1.cls');
      const uris = [vscode.Uri.file(filePath1)];
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
        .stub(SalesforcePackageDirectories, 'isInPackageDirectory')
        .returns(true);
      const flushFilePathsStub = sb
        .stub(fileUtils, 'flushFilePaths')
        .returns([path.sep + filePath1]);

      await deploySourcePath.deploySourcePaths(uris[0], uris);

      expect(timestampConflictCheckerCheckStub.called).to.equal(true);
      const continueResponse = timestampConflictCheckerCheckStub
        .args[0][0] as ContinueResponse<string[]>;
      expect(JSON.stringify(continueResponse.data)).to.equal(
        JSON.stringify(filePaths)
      );

      flushFilePathsStub.restore();
      isInPackageDirectoryStub.restore();
      timestampConflictCheckerCheckStub.restore();
    });

    it('should deploy when editing single file and "Deploy This Source from Org" is executed', async () => {
      const filePath1 = path.join('classes', 'MyClass1.cls');
      const uris = [vscode.Uri.file(filePath1)];
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
        .stub(SalesforcePackageDirectories, 'isInPackageDirectory')
        .returns(true);
      const flushFilePathsStub = sb
        .stub(fileUtils, 'flushFilePaths')
        .returns([path.sep + filePath1]);

      await deploySourcePath.deploySourcePaths(uris[0], undefined);

      expect(timestampConflictCheckerCheckStub.called).to.equal(true);
      const continueResponse = timestampConflictCheckerCheckStub
        .args[0][0] as ContinueResponse<string[]>;
      expect(JSON.stringify(continueResponse.data)).to.equal(
        JSON.stringify(filePaths)
      );

      flushFilePathsStub.restore();
      isInPackageDirectoryStub.restore();
      timestampConflictCheckerCheckStub.restore();
    });

    it('should deploy when using the command palette', async () => {
      const filePath1 = path.join('classes', 'MyClass1.cls');

      // When deploying via the command palette,
      // sourceUri is undefined, and uris is undefined as well,
      // and the path is obtained from the active editor
      // (and calling getUriFromActiveEditor())
      const sourceUri = undefined;
      const uris = undefined;

      const filePaths = [filePath1];
      const timestampConflictCheckerCheckStub = sb
        .stub(TimestampConflictChecker.prototype, 'check')
        .returns({
          type: 'CONTINUE',
          data: filePaths
        });
      const isInPackageDirectoryStub = sb
        .stub(SalesforcePackageDirectories, 'isInPackageDirectory')
        .returns(true);
      const getUriFromActiveEditorStub = sb
        .stub(deploySourcePath, 'getUriFromActiveEditor')
        .returns(filePath1);
      const flushFilePathsStub = sb
        .stub(fileUtils, 'flushFilePaths')
        .returns([undefined]);

      await deploySourcePath.deploySourcePaths(sourceUri, uris);

      expect(getUriFromActiveEditorStub.called).to.equal(true);

      flushFilePathsStub.restore();
      getUriFromActiveEditorStub.restore();
      isInPackageDirectoryStub.restore();
      timestampConflictCheckerCheckStub.restore();
    });

    it('should deploy when saving and the "salesforcedx-vscode-core.push-or-deploy-on-save" setting is on', async () => {
      const filePath1 = path.join('classes', 'MyClass1.cls');

      // When the push-or-deploy-on-save setting is on,
      // sourceUri is an array, and uris is undefined.
      const sourceUris: vscode.Uri[] = [vscode.Uri.file(filePath1)];
      const uris = undefined;

      const filePaths = sourceUris.map(uri => {
        return uri.fsPath;
      });
      const timestampConflictCheckerCheckStub = sb
        .stub(TimestampConflictChecker.prototype, 'check')
        .returns({
          type: 'CONTINUE',
          data: filePaths
        });
      const isInPackageDirectoryStub = sb
        .stub(SalesforcePackageDirectories, 'isInPackageDirectory')
        .returns(true);
      const flushFilePathsStub = sb
        .stub(fileUtils, 'flushFilePaths')
        .returns([path.sep + filePath1]);

      await deploySourcePath.deploySourcePaths(sourceUris, uris);

      expect(timestampConflictCheckerCheckStub.called).to.equal(true);
      const continueResponse = timestampConflictCheckerCheckStub
        .args[0][0] as ContinueResponse<string[]>;
      expect(JSON.stringify(continueResponse.data)).to.equal(
        JSON.stringify(filePaths)
      );

      flushFilePathsStub.restore();
      isInPackageDirectoryStub.restore();
      timestampConflictCheckerCheckStub.restore();
    });
  });
});
