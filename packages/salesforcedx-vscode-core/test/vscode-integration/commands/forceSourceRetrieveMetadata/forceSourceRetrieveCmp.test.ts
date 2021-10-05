/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { CommandOutput } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  ContinueResponse,
  LocalComponent
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import {
  ComponentSet,
  MetadataResolver,
  RegistryAccess,
  RetrieveResult
} from '@salesforce/source-deploy-retrieve';
import {
  MetadataApiRetrieveStatus,
  RequestStatus
} from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import { expect } from 'chai';
import * as path from 'path';
import { createSandbox, mock, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { RetrieveDescriber } from '../../../../src/commands/forceSourceRetrieveMetadata';
import {
  ForceSourceRetrieveExecutor,
  LibraryRetrieveSourcePathExecutor
} from '../../../../src/commands/forceSourceRetrieveMetadata/forceSourceRetrieveCmp';
import { workspaceContext } from '../../../../src/context';
import { SfdxPackageDirectories } from '../../../../src/sfdxProject';
import { getRootWorkspacePath } from '../../../../src/util';
import { matchingContentFile, mockRegistry, mockRegistryData } from '../../mock/registry';

const sb = createSandbox();
const $$ = testSetup();

class TestDescriber implements RetrieveDescriber {
  public buildMetadataArg(data?: LocalComponent[]): string {
    return data ? `${data[0].type}:${data[0].fileName}` : 'TestType:Test1';
  }

  public gatherOutputLocations(): Promise<LocalComponent[]> {
    throw new Error('Method not implemented.');
  }
}

describe('Force Source Retrieve Component(s)', () => {
  describe('CLI Executor', () => {
    const forceSourceRetrieveExec = new ForceSourceRetrieveExecutor(
      new TestDescriber()
    );

    it('Should build source retrieve command', async () => {
      const forceSourceRetrieveCmd = forceSourceRetrieveExec.build();
      expect(forceSourceRetrieveCmd.toCommand()).to.equal(
        `sfdx force:source:retrieve --json --loglevel fatal -m TestType:Test1`
      );
    });

    it('Should pass optional data to describer', () => {
      const data = [{ fileName: 'Test2', outputdir: '', type: 'TestType2' }];
      const forceSourceRetrieveCmd = forceSourceRetrieveExec.build(data);
      expect(forceSourceRetrieveCmd.toCommand()).to.equal(
        `sfdx force:source:retrieve --json --loglevel fatal -m TestType2:Test2`
      );
    });

    describe('Force Source Retrieve and open', () => {
      const openAfterRetrieve: boolean = true;
      const executor = new ForceSourceRetrieveExecutor(
        new TestDescriber(),
        openAfterRetrieve
      );
      let openTextDocumentStub: SinonStub;
      let showTextDocumentStub: SinonStub;
      const resultData = `{
        "status": 0,
        "result": {
          "inboundFiles": [
            {
              "state": "Add",
              "fullName": "TestClass",
              "type": "ApexClass",
              "filePath": "force-app/main/default/classes/TestClass.cls"}
      ] }}`;
      let getCmdResultStub: SinonStub;

      beforeEach(() => {
        openTextDocumentStub = sb.stub(vscode.workspace, 'openTextDocument');
        showTextDocumentStub = sb.stub(vscode.window, 'showTextDocument');
        getCmdResultStub = sb
          .stub(CommandOutput.prototype, 'getCmdResult')
          .returns(resultData);
      });

      afterEach(() => {
        sb.restore();
      });

      it('Should build source retrieve command', async () => {
        const response = [
          {
            type: 'CONTINUE',
            data: [
              {
                fileName: 'DemoController',
                outputdir:
                  '/Users/testUser/testProject/force-app/main/default/classes/DemoController.cls',
                type: 'ApexClass',
                suffix: 'cls'
              }
            ]
          }
        ];

        await executor.execute(response);

        expect(getCmdResultStub.called).to.equal(true);
        expect(openTextDocumentStub.called).to.equal(true);
        expect(showTextDocumentStub.called).to.equal(true);
      });

      it('Should retrieve resource without defined file extensions', async () => {
        const response = [
          {
            type: 'CONTINUE',
            data: [
              {
                fileName: 'Account',
                outputdir:
                  '/Users/testUser/testProject/force-app/main/default/classes/Account.object-meta.xml',
                type: 'customobject',
                suffix: 'object',
                directory: 'objects'
              }
            ]
          }
        ];

        await executor.execute(response);

        expect(getCmdResultStub.called).to.equal(true);
        expect(openTextDocumentStub.called).to.equal(true);
        expect(showTextDocumentStub.called).to.equal(true);
      });
    });
  });

  describe('Library Executor', () => {
    const testData = new MockTestOrgData();
    const defaultPackageDir = 'test-app';

    let mockConnection: Connection;

    let openTextDocumentStub: SinonStub;
    let showTextDocumentStub: SinonStub;
    let pollStatusStub: SinonStub;
    let retrieveStub: SinonStub;

    beforeEach(async () => {
      $$.setConfigStubContents('AuthInfoConfig', {
        contents: await testData.getConfig()
      });
      mockConnection = await Connection.create({
        authInfo: await AuthInfo.create({
          username: testData.username
        })
      });
      sb.stub(workspaceContext, 'getConnection').returns(mockConnection);

      sb.stub(SfdxPackageDirectories, 'getDefaultPackageDir').returns(
        defaultPackageDir
      );
      sb.stub(SfdxPackageDirectories, 'getPackageDirectoryFullPaths').resolves([
        path.join(getRootWorkspacePath(), defaultPackageDir)
      ]);
      sb.stub(SfdxPackageDirectories, 'getPackageDirectoryPaths').resolves([
        defaultPackageDir
      ]);

      sb.stub(MetadataResolver.prototype, 'getComponentsFromPath').returns([]);
      openTextDocumentStub = sb.stub(vscode.workspace, 'openTextDocument');
      showTextDocumentStub = sb.stub(vscode.window, 'showTextDocument');
      pollStatusStub = sb.stub();
      retrieveStub = sb.stub(ComponentSet.prototype, 'retrieve').returns({
        pollStatus: pollStatusStub
      });
    });

    afterEach(() => {
      $$.SANDBOX.restore();
      sb.restore();
    });

    it('should retrieve with given components', async () => {
      const executor = new LibraryRetrieveSourcePathExecutor();
      const testComponents = matchingContentFile.COMPONENTS;
      const componentSet = new ComponentSet(testComponents, mockRegistry);
      const response: ContinueResponse<LocalComponent[]> = {
        type: 'CONTINUE',
        data: testComponents.map(c => ({
          fileName: c.fullName,
          type: c.type.name,
          outputdir: 'out'
        }))
      };

      sb.stub(ComponentSet, 'fromSource').returns(componentSet);

      await executor.run(response);

      expect(retrieveStub.calledOnce).to.equal(true);
      expect(retrieveStub.firstCall.args[0]).to.deep.equal({
        usernameOrConnection: mockConnection,
        output: path.join(getRootWorkspacePath(), 'test-app'),
        merge: true
      });

      const retrievedSet = retrieveStub.firstCall.thisValue as ComponentSet;

      expect(retrievedSet).to.not.equal(undefined);
      expect(retrievedSet.has(testComponents[0])).to.equal(true);
      expect(retrievedSet.has(testComponents[1])).to.equal(true);

      expect(openTextDocumentStub.called).to.equal(false);
      expect(showTextDocumentStub.called).to.equal(false);
    });

    it('should retrieve components and merge with local versions if present', async () => {
      const executor = new LibraryRetrieveSourcePathExecutor();
      const testComponents = matchingContentFile.COMPONENTS;
      const componentSet = new ComponentSet([matchingContentFile.COMPONENTS[1]], mockRegistry);
      const response: ContinueResponse<LocalComponent[]> = {
        type: 'CONTINUE',
        data: testComponents.map(c => ({
          fileName: c.fullName,
          type: c.type.name,
          outputdir: 'out'
        }))
      };

      sb.stub(RegistryAccess.prototype, 'getTypeByName').returns(mockRegistryData.types.matchingcontentfile);
      sb.stub(ComponentSet, 'fromSource').returns(componentSet);

      await executor.run(response);

      const retrievedSet = retrieveStub.firstCall.thisValue as ComponentSet;

      // verify there are two components retrieved, but only one is source backed
      expect(retrievedSet.size).to.equal(2);
      expect(retrievedSet.getSourceComponents().toArray().length).to.equal(1);
    });

    it('should retrieve with given components and open them', async () => {
      const executor = new LibraryRetrieveSourcePathExecutor(true);

      const testComponents = matchingContentFile.COMPONENTS;
      const componentSet = new ComponentSet(testComponents, mockRegistry);
      sb.stub(ComponentSet, 'fromSource').returns(componentSet);

      const retrieveResponse: Partial<MetadataApiRetrieveStatus> = {
        fileProperties: [],
        status: RequestStatus.Succeeded
      };
      pollStatusStub.resolves(
        new RetrieveResult(
          retrieveResponse as MetadataApiRetrieveStatus,
          componentSet
        )
      );

      const response: ContinueResponse<LocalComponent[]> = {
        type: 'CONTINUE',
        data: testComponents.map(c => ({
          fileName: c.fullName,
          type: c.type.name,
          outputdir: 'out'
        }))
      };

      await executor.run(response);

      expect(showTextDocumentStub.callCount).to.equal(2);
      expect(openTextDocumentStub.callCount).to.equal(2);

      const openArg1 = openTextDocumentStub.firstCall.args[0];
      expect(openArg1).to.equal(matchingContentFile.XML_PATHS[0]);

      const openArg2 = openTextDocumentStub.secondCall.args[0];
      expect(openArg2).to.equal(matchingContentFile.CONTENT_PATHS[0]);
    });
  });
});
