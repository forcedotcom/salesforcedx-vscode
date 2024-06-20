/*
 * Copyright (c) 2019, salesforce.com, inc.
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
import {
  ContinueResponse,
  LocalComponent,
  SourceTrackingService
} from '@salesforce/salesforcedx-utils-vscode';
import {
  ComponentSet,
  MetadataResolver,
  registry,
  RetrieveResult,
  SourceComponent
} from '@salesforce/source-deploy-retrieve';
import {
  MetadataApiRetrieveStatus,
  RequestStatus
} from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import { expect } from 'chai';
import * as path from 'path';
import { SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { RetrieveDescriber } from '../../../../src/commands/retrieveMetadata';
import { LibraryRetrieveSourcePathExecutor } from '../../../../src/commands/retrieveMetadata/libraryRetrieveSourcePathExecutor';
import { WorkspaceContext } from '../../../../src/context';
import { SalesforcePackageDirectories } from '../../../../src/salesforceProject';
import { workspaceUtils } from '../../../../src/util';

const $$ = instantiateContext();
const sb = $$.SANDBOX;

class TestDescriber implements RetrieveDescriber {
  public buildMetadataArg(data?: LocalComponent[]): string {
    return data ? `${data[0].type}:${data[0].fileName}` : 'TestType:Test1';
  }

  public gatherOutputLocations(): Promise<LocalComponent[]> {
    throw new Error('Method not implemented.');
  }
}

describe('Retrieve Component(s)', () => {
  describe('Library Executor', () => {
    const testData = new MockTestOrgData();
    const defaultPackageDir = 'test-app';

    let mockConnection: Connection;

    let openTextDocumentStub: SinonStub;
    let showTextDocumentStub: SinonStub;
    let pollStatusStub: SinonStub;
    let retrieveStub: SinonStub;

    beforeEach(async () => {
      stubContext($$);
      $$.setConfigStubContents('AuthInfoConfig', {
        contents: await testData.getConfig()
      });
      mockConnection = await testData.getConnection();
      sb.stub(WorkspaceContext.prototype, 'getConnection').returns(
        mockConnection
      );

      sb.stub(SalesforcePackageDirectories, 'getDefaultPackageDir').returns(
        defaultPackageDir
      );
      sb.stub(
        SalesforcePackageDirectories,
        'getPackageDirectoryFullPaths'
      ).resolves([
        path.join(workspaceUtils.getRootWorkspacePath(), defaultPackageDir)
      ]);
      sb.stub(
        SalesforcePackageDirectories,
        'getPackageDirectoryPaths'
      ).resolves([defaultPackageDir]);

      sb.stub(MetadataResolver.prototype, 'getComponentsFromPath').returns([]);
      openTextDocumentStub = sb.stub(vscode.workspace, 'openTextDocument');
      showTextDocumentStub = sb.stub(vscode.window, 'showTextDocument');
      pollStatusStub = sb.stub();
      retrieveStub = sb.stub(ComponentSet.prototype, 'retrieve').returns({
        pollStatus: pollStatusStub
      });
      sb.stub(SourceTrackingService, 'getSourceTracking');
      sb.stub(SourceTrackingService, 'updateSourceTrackingAfterRetrieve');
    });

    afterEach(() => {
      restoreContext($$);
    });

    it('should retrieve with given components', async () => {
      const executor = new LibraryRetrieveSourcePathExecutor();
      const testComponents = [
        { fullName: 'MyClassA', type: 'ApexClass' },
        { fullName: 'MyClassB', type: 'ApexClass' }
      ];
      const componentSet = new ComponentSet(testComponents);
      const response: ContinueResponse<LocalComponent[]> = {
        type: 'CONTINUE',
        data: testComponents.map(c => ({
          fileName: c.fullName,
          type: c.type,
          outputdir: 'out'
        }))
      };

      sb.stub(ComponentSet, 'fromSource').returns(componentSet);

      await executor.run(response);

      expect(retrieveStub.calledOnce).to.equal(true);
      expect(retrieveStub.firstCall.args[0]).to.deep.equal({
        usernameOrConnection: mockConnection,
        output: path.join(workspaceUtils.getRootWorkspacePath(), 'test-app'),
        merge: true,
        suppressEvents: false
      });

      const retrievedSet = retrieveStub.firstCall.thisValue as ComponentSet;

      expect(retrievedSet).to.not.equal(undefined);
      expect(retrievedSet.has(testComponents[0])).to.equal(true);
      expect(retrievedSet.has(testComponents[1])).to.equal(true);

      expect(openTextDocumentStub.called).to.equal(false);
      expect(showTextDocumentStub.called).to.equal(false);
    });

    it('should retrieve components and merge with local versions if present', async () => {
      const type = registry.types.apexclass;
      const executor = new LibraryRetrieveSourcePathExecutor();
      const testComponents = [
        { fullName: 'MyClassA', type: 'ApexClass' },
        { fullName: 'MyClassB', type: 'ApexClass' }
      ];
      const response: ContinueResponse<LocalComponent[]> = {
        type: 'CONTINUE',
        data: testComponents.map(c => ({
          fileName: c.fullName,
          type: c.type,
          outputdir: 'out'
        }))
      };

      sb.stub(ComponentSet, 'fromSource').returns(
        new ComponentSet([
          new SourceComponent({
            name: 'MyClassB',
            type,
            content: path.join(String(type.directoryName), 'MyClassB.cls'),
            xml: path.join(String(type.directoryName), 'MyClassB.cls-meta.xml')
          })
        ])
      );

      await executor.run(response);

      const retrievedSet = retrieveStub.firstCall.thisValue as ComponentSet;

      // verify there are two components retrieved, but only one is source backed
      expect(retrievedSet.size).to.equal(2);
      expect(retrievedSet.getSourceComponents().toArray().length).to.equal(1);
    });

    it('should retrieve with given components and open them', async () => {
      const executor = new LibraryRetrieveSourcePathExecutor(true);
      const type = registry.types.apexclass;
      const className = 'MyClass';
      const className2 = 'MyClass';
      const apexClassPathOne = path.join(
        String(type.directoryName),
        `${className}.cls`
      );
      const apexClassPathTwo = path.join(
        String(type.directoryName),
        `${className2}.cls`
      );
      const apexClassXmlPathOne = path.join(
        String(type.directoryName),
        `${apexClassPathOne}-meta.xml`
      );
      const apexClassXmlPathTwo = path.join(
        String(type.directoryName),
        `${className2}.cls-meta.xml`
      );
      const virtualTree = [
        {
          dirPath: 'classes',
          children: [
            `${className}.cls`,
            `${className}.cls-meta.xml`,
            `${className2}.cls`,
            `${className2}.cls-meta.xml`
          ]
        }
      ];

      const testComponents = [
        SourceComponent.createVirtualComponent(
          {
            name: className,
            type: registry.types.apexclass,
            xml: apexClassXmlPathOne,
            content: apexClassPathOne
          },
          virtualTree
        ),
        SourceComponent.createVirtualComponent(
          {
            name: className,
            type: registry.types.apexclass,
            xml: apexClassXmlPathTwo,
            content: apexClassPathTwo
          },
          virtualTree
        )
      ];
      const componentSet = new ComponentSet(testComponents);
      sb.stub(ComponentSet, 'fromSource').returns(componentSet);

      const retrieveResponse: Partial<MetadataApiRetrieveStatus> = {
        fileProperties: [],
        status: RequestStatus.Succeeded
      };
      pollStatusStub.resolves(
        new RetrieveResult(
          retrieveResponse ,
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
      expect(openArg1).to.equal(apexClassXmlPathOne);

      const openArg2 = openTextDocumentStub.secondCall.args[0];
      expect(openArg2).to.equal(apexClassPathOne);
    });
  });
});
