/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { Table } from '@salesforce/salesforcedx-utils-vscode/out/src/output';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import {
  ComponentSet,
  DeployResult,
  registryData,
  RetrieveResult,
  SourceComponent,
  ToolingApi
} from '@salesforce/source-deploy-retrieve';
import {
  ComponentStatus,
  MetadataApiDeployStatus,
  MetadataApiRetrieveStatus,
  RequestStatus
} from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import { expect } from 'chai';
import { basename, dirname, join, sep } from 'path';
import { createSandbox, match, SinonStub } from 'sinon';
import Sinon = require('sinon');
import * as vscode from 'vscode';
import { channelService } from '../../../src/channels';
import { BaseDeployExecutor, getExecutor } from '../../../src/commands';
import {
  DeployExecutor,
  DeployRetrieveExecutor,
  RetrieveExecutor
} from '../../../src/commands/baseDeployRetrieve';
import { LibrarySourceDeployManifestExecutor } from '../../../src/commands/forceSourceDeployManifest';
import { LibraryRetrieveSourcePathExecutor } from '../../../src/commands/forceSourceRetrieveMetadata/forceSourceRetrieveCmp';
import { workspaceContext } from '../../../src/context';
import { nls } from '../../../src/messages';
import { DeployQueue } from '../../../src/settings';
import {
  SfdxPackageDirectories,
  SfdxProjectConfig
} from '../../../src/sfdxProject';
import * as path from 'path';

const sb = createSandbox();
const $$ = testSetup();

describe('Base Deploy Retrieve Commands', () => {
  let mockConnection: Connection;

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
    sb.stub(workspaceContext, 'getConnection').resolves(mockConnection);
  });

  afterEach(() => sb.restore());

  describe('DeployRetrieveCommand', () => {
    class TestDeployRetrieve extends DeployRetrieveExecutor<{}> {
      public lifecycle = {
        getComponentsStub: sb.stub().returns(new ComponentSet()),
        doOperationStub: sb.stub(),
        postOperationStub: sb.stub()
      };

      constructor() {
        super('test', 'testlog');
      }

      protected getComponents(
        response: ContinueResponse<{}>
      ): Promise<ComponentSet> {
        return this.lifecycle.getComponentsStub();
      }
      protected doOperation(components: ComponentSet): Promise<undefined> {
        return this.lifecycle.doOperationStub();
      }
      protected postOperation(result: undefined): Promise<void> {
        return this.lifecycle.postOperationStub();
      }
    }

    it('should call lifecycle methods in correct order', async () => {
      const executor = new TestDeployRetrieve();
      const {
        doOperationStub,
        getComponentsStub,
        postOperationStub
      } = executor.lifecycle;

      await executor.run({ data: {}, type: 'CONTINUE' });

      expect(getComponentsStub.calledOnce).to.equal(true);
      expect(doOperationStub.calledAfter(getComponentsStub)).to.equal(true);
      expect(postOperationStub.calledAfter(doOperationStub)).to.equal(true);
    });

    it('should add component count to telemetry data', async () => {
      const executor = new TestDeployRetrieve();
      const components = new ComponentSet([
        { fullName: 'MyClass', type: 'ApexClass' },
        { fullName: 'MyClass2', type: 'ApexClass' },
        { fullName: 'MyLayout', type: 'Layout' }
      ]);
      executor.lifecycle.getComponentsStub.returns(components);

      await executor.run({ data: {}, type: 'CONTINUE' });

      const { properties } = executor.telemetryData;
      expect(properties).to.not.equal(undefined);

      const { metadataCount } = properties!;
      expect(metadataCount).to.not.equal(undefined);

      const componentCount = JSON.parse(metadataCount);
      expect(componentCount).to.deep.equal([
        { type: 'ApexClass', quantity: 2 },
        { type: 'Layout', quantity: 1 }
      ]);
    });

    it('should return success when operation status is "Succeeded"', async () => {
      const executor = new TestDeployRetrieve();
      executor.lifecycle.doOperationStub.resolves({
        response: { status: RequestStatus.Succeeded }
      });

      const success = await executor.run({ data: {}, type: 'CONTINUE' });

      expect(success).to.equal(true);
    });

    it('should return success when operation status is "SucceededPartial"', async () => {
      const executor = new TestDeployRetrieve();
      executor.lifecycle.doOperationStub.resolves({
        response: { status: RequestStatus.SucceededPartial }
      });

      const success = await executor.run({ data: {}, type: 'CONTINUE' });

      expect(success).to.equal(true);
    });

    it('should return unsuccessful when operation status is "Failed"', async () => {
      const executor = new TestDeployRetrieve();
      executor.lifecycle.doOperationStub.resolves({
        response: { status: RequestStatus.Failed }
      });

      const success = await executor.run({ data: {}, type: 'CONTINUE' });

      expect(success).to.equal(false);
    });
  });

  describe('DeployExecutor', () => {
    let deployQueueStub: SinonStub;
    // let withProgressStub: SinonStub;

    const packageDir = 'test-app';

    beforeEach(async () => {
      sb.stub(SfdxPackageDirectories, 'getPackageDirectoryPaths').resolves([
        packageDir
      ]);

      deployQueueStub = sb.stub(DeployQueue.prototype, 'unlock');

      // withProgressStub = sb.stub(vscode.window, 'withProgress').returns(
      //   Promise.resolve()
      // );

      // Approach used by forceFunctionCreate.test.ts
      // withProgressStub = sb.stub(vscode.window, 'withProgress');   
      // withProgressStub.callsFake((options, task) => {
      //   task();
      // });    
    });

    // afterEach(async () => {
    //   withProgressStub.restore();
    // });

    class TestDeploy extends DeployExecutor<{}> {
      public components: ComponentSet;
      public getComponentsStub = sb.stub().returns(new ComponentSet());
      public startStub: SinonStub;
      public deployStub: SinonStub;

      constructor(toDeploy = new ComponentSet()) {
        super('test', 'testlog');
        this.components = toDeploy;
        this.startStub = sb.stub();
        this.deployStub = sb
          .stub(this.components, 'deploy')
          .returns({ start: this.startStub });
      }

      protected async getComponents(
        response: ContinueResponse<{}>
      ): Promise<ComponentSet> {
        return this.components;
      }
    }

    class TestDeploy2 extends DeployExecutor<{}> {
      public components: ComponentSet;
      public getComponentsStub = sb.stub().returns(new ComponentSet());
      // public startStub: SinonStub;
      // public deployStub: SinonStub;
      public progressStub: SinonStub;

      constructor(toDeploy = new ComponentSet()) {
        super('test', 'testlog');
        this.components = toDeploy;
        // this.startStub = sb.stub();
        // this.deployStub = sb
        //   .stub(this.components, 'deploy')
        //   .returns({ start: this.startStub });
        this.progressStub = sb.stub(vscode.window, 'withProgress').returns(
          Promise.resolve()
        );
      }

      protected async getComponents(
        response: ContinueResponse<{}>
      ): Promise<ComponentSet> {
        return this.components;
      }
    }

    // TODO
    it('should be cancellable', async () => {
      const cancelledExeuctor = new TestDeploy2();
      const filePath = path.join('classes', 'MyClass.cls');

      await cancelledExeuctor.run({ data: filePath, type: 'CONTINUE' });

      Sinon.assert.calledOnce(cancelledExeuctor.progressStub);
      Sinon.assert.calledWith(
        cancelledExeuctor.progressStub,
        {
          location: vscode.ProgressLocation.Window,
          title: nls.localize('progress_notification_text', 'todo'),
          cancellable: true
        },
        match.any
      );
    });

    // TODO
    it('should call cancel operation', async () => {
      const executor = new TestDeploy();

      await executor.run({ data: {}, type: 'CONTINUE' });
    });

    it('should call deploy on component set', async () => {
      const executor = new TestDeploy();

      await executor.run({ data: {}, type: 'CONTINUE' });

      expect(executor.deployStub.calledOnce).to.equal(true);
      expect(executor.deployStub.firstCall.args[0]).to.deep.equal({
        usernameOrConnection: mockConnection
      });
      expect(executor.startStub.calledOnce).to.equal(true);
    });

    describe('Result Output', () => {
      let appendLineStub: SinonStub;

      const fileResponses: any[] = [
        {
          fullName: 'MyClass',
          type: 'ApexClass',
          state: ComponentStatus.Changed,
          filePath: join('project', packageDir, 'MyClass.cls')
        },
        {
          fullName: 'MyClass',
          type: 'ApexClass',
          state: ComponentStatus.Changed,
          filePath: join('project', packageDir, 'MyClass.cls-meta.xml')
        },
        {
          fullName: 'MyLayout',
          type: 'Layout',
          state: ComponentStatus.Created,
          filePath: join('project', packageDir, 'MyLayout.layout-meta.xml')
        }
      ];

      beforeEach(() => {
        appendLineStub = sb.stub(channelService, 'appendLine');
      });

      it('should output table of deployed components if successful', async () => {
        const executor = new TestDeploy();

        const mockDeployResult = new DeployResult(
          {
            status: RequestStatus.Succeeded
          } as MetadataApiDeployStatus,
          new ComponentSet()
        );
        sb.stub(mockDeployResult, 'getFileResponses').returns(fileResponses);
        executor.startStub.resolves(mockDeployResult);

        const formattedRows = fileResponses.map(r => ({
          fullName: r.fullName,
          type: r.type,
          state: r.state,
          filePath: r.filePath.replace(`project${sep}`, '')
        }));
        const expectedOutput = new Table().createTable(
          formattedRows,
          [
            { key: 'state', label: nls.localize('table_header_state') },
            { key: 'fullName', label: nls.localize('table_header_full_name') },
            { key: 'type', label: nls.localize('table_header_type') },
            {
              key: 'filePath',
              label: nls.localize('table_header_project_path')
            }
          ],
          nls.localize(`table_title_deployed_source`)
        );

        await executor.run({ data: {}, type: 'CONTINUE' });

        expect(appendLineStub.calledOnce).to.equal(true);
        expect(appendLineStub.firstCall.args[0]).to.equal(expectedOutput);
      });

      it('should output table of failed components if unsuccessful', async () => {
        const executor = new TestDeploy();

        const mockDeployResult = new DeployResult(
          {
            status: RequestStatus.Failed
          } as MetadataApiDeployStatus,
          new ComponentSet()
        );
        executor.startStub.resolves(mockDeployResult);

        const failedRows = fileResponses.map(r => ({
          fullName: r.fullName,
          type: r.type,
          error: 'There was an issue',
          filePath: r.filePath
        }));
        sb.stub(mockDeployResult, 'getFileResponses').returns(failedRows);

        const formattedRows = fileResponses.map(r => ({
          fullName: r.fullName,
          type: r.type,
          error: 'There was an issue',
          filePath: r.filePath.replace(`project${sep}`, '')
        }));
        const expectedOutput = new Table().createTable(
          formattedRows,
          [
            {
              key: 'filePath',
              label: nls.localize('table_header_project_path')
            },
            { key: 'error', label: nls.localize('table_header_errors') }
          ],
          nls.localize(`table_title_deploy_errors`)
        );

        await executor.run({ data: {}, type: 'CONTINUE' });

        expect(appendLineStub.calledOnce).to.equal(true);
        expect(appendLineStub.firstCall.args[0]).to.equal(expectedOutput);
      });

      it('should report any diagnostics if deploy failed', async () => {
        const executor = new TestDeploy();

        const mockDeployResult = new DeployResult(
          {
            status: RequestStatus.Failed
          } as MetadataApiDeployStatus,
          new ComponentSet()
        );
        executor.startStub.resolves(mockDeployResult);

        const failedRows = fileResponses.map(r => ({
          fullName: r.fullName,
          type: r.type,
          error: 'There was an issue',
          state: ComponentStatus.Failed,
          filePath: r.filePath,
          problemType: 'Error',
          lineNumber: 2,
          columnNumber: 3
        }));
        sb.stub(mockDeployResult, 'getFileResponses').returns(failedRows);

        const setDiagnosticsStub = sb.stub(
          BaseDeployExecutor.errorCollection,
          'set'
        );

        await executor.run({ data: {}, type: 'CONTINUE' });

        expect(setDiagnosticsStub.callCount).to.equal(failedRows.length);
        failedRows.forEach((row, index) => {
          expect(setDiagnosticsStub.getCall(index).args).to.deep.equal([
            vscode.Uri.file(row.filePath),
            [
              {
                message: row.error,
                range: new vscode.Range(
                  row.lineNumber - 1,
                  row.columnNumber - 1,
                  row.lineNumber - 1,
                  row.columnNumber - 1
                ),
                severity: vscode.DiagnosticSeverity.Error,
                source: row.type
              }
            ]
          ]);
        });
      });
    });

    it('should unlock the deploy queue when finished', async () => {
      const executor = new TestDeploy();

      await executor.run({ data: {}, type: 'CONTINUE' });

      expect(deployQueueStub.calledOnce).to.equal(true);
    });
  });

  describe('RetrieveExecutor', () => {
    const packageDir = 'test-app';
    const props = {
      name: 'MyTrigger',
      type: registryData.types.apextrigger,
      content: join('project', 'classes', 'MyTrigger.cls'),
      xml: join('project', 'classes', 'MyTrigger.cls-meta.xml')
    };
    const component = SourceComponent.createVirtualComponent(props, [
      {
        dirPath: dirname(props.content),
        children: [basename(props.content), basename(props.xml)]
      }
    ]);

    class TestRetrieve extends RetrieveExecutor<{}> {
      public components: ComponentSet;
      public startStub: SinonStub;
      public retrieveStub: SinonStub;
      public toolingRetrieveStub: SinonStub;

      constructor(toRetrieve = new ComponentSet()) {
        super('test', 'testlog');
        this.components = toRetrieve;
        this.startStub = sb.stub();
        this.retrieveStub = sb
          .stub(this.components, 'retrieve')
          .returns({ start: this.startStub });
        this.toolingRetrieveStub = sb.stub(ToolingApi.prototype, 'retrieve');
      }

      protected async getComponents(
        response: ContinueResponse<{}>
      ): Promise<ComponentSet> {
        return this.components;
      }
    }

    beforeEach(() => {
      sb.stub(SfdxPackageDirectories, 'getPackageDirectoryPaths').resolves([
        packageDir
      ]);
    });

    it('should utilize Tooling API if retrieving one source-backed component', async () => {
      const components = new ComponentSet([
        new SourceComponent({
          name: 'MyClass',
          type: registryData.types.apexclass,
          content: join('project', 'classes', 'MyClass.cls'),
          xml: join('project', 'classes', 'MyClass.cls-meta.xml')
        })
      ]);
      const executor = new TestRetrieve(components);

      await executor.run({ data: {}, type: 'CONTINUE' });

      expect(executor.toolingRetrieveStub.callCount).to.equal(1);
      expect(executor.retrieveStub.callCount).to.equal(0);
    });

    it('should pass project namespace when using Tooling API', async () => {
      const components = new ComponentSet([
        new SourceComponent({
          name: 'MyClass',
          type: registryData.types.apexclass,
          content: join('project', 'classes', 'MyClass.cls'),
          xml: join('project', 'classes', 'MyClass.cls-meta.xml')
        })
      ]);
      const executor = new TestRetrieve(components);
      sb.stub(SfdxProjectConfig, 'getValue')
        .withArgs('namespace')
        .returns('testns');

      await executor.run({ data: {}, type: 'CONTINUE' });

      expect(executor.toolingRetrieveStub.callCount).to.equal(1);
      expect(executor.toolingRetrieveStub.firstCall.args[0]).to.deep.equal({
        components,
        namespace: 'testns'
      });
    });

    it('should not utilize Tooling API if retrieving one source-backed component but type is unsupported', async () => {
      const components = new ComponentSet([
        new SourceComponent({
          name: 'MyLayout',
          type: registryData.types.layout,
          xml: join('project', 'layouts', 'MyLayout.cls-meta.xml')
        })
      ]);
      const executor = new TestRetrieve(components);

      await executor.run({ data: {}, type: 'CONTINUE' });

      expect(executor.toolingRetrieveStub.callCount).to.equal(0);
      expect(executor.retrieveStub.callCount).to.equal(1);
    });

    it('should call retrieve on component set', async () => {
      const components = new ComponentSet([
        { fullName: 'MyClass', type: 'ApexClass' },
        { fullName: 'MyTrigger', type: 'ApexTrigger' }
      ]);
      const executor = new TestRetrieve(components);

      await executor.run({ data: {}, type: 'CONTINUE' });

      expect(executor.toolingRetrieveStub.callCount).to.equal(0);
      expect(executor.retrieveStub.callCount).to.equal(1);
    });

    describe('Result Output', () => {
      let appendLineStub: SinonStub;

      beforeEach(() => {
        appendLineStub = sb.stub(channelService, 'appendLine');
      });

      it('should output table of components for successful tooling retrieve', async () => {
        const componentSet = new ComponentSet([component]);
        const executor = new TestRetrieve(componentSet);
        executor.toolingRetrieveStub.resolves({
          successes: [
            {
              component
            }
          ],
          failures: []
        });

        const expectedOutput = new Table().createTable(
          [
            {
              fullName: component.fullName,
              type: component.type.name,
              filePath: component.content!
            },
            {
              fullName: component.fullName,
              type: component.type.name,
              filePath: component.xml!
            }
          ],
          [
            { key: 'fullName', label: nls.localize('table_header_full_name') },
            { key: 'type', label: nls.localize('table_header_type') },
            {
              key: 'filePath',
              label: nls.localize('table_header_project_path')
            }
          ],
          nls.localize(`lib_retrieve_result_title`)
        );

        await executor.run({ data: {}, type: 'CONTINUE' });

        expect(appendLineStub.callCount).to.equal(1);
        expect(appendLineStub.firstCall.args[0]).to.equal(expectedOutput);
      });

      it('should output table of components for failed tooling retrieve', async () => {
        const componentSet = new ComponentSet([component]);
        const executor = new TestRetrieve(componentSet);
        executor.toolingRetrieveStub.resolves({
          successes: [],
          failures: [
            {
              component,
              message: `${component.fullName} was not found in org`
            }
          ]
        });

        const expectedOutput = new Table().createTable(
          [
            {
              fullName: component.fullName,
              type: component.type.name,
              error: `${component.fullName} was not found in org`
            }
          ],
          [
            { key: 'fullName', label: nls.localize('table_header_full_name') },
            { key: 'type', label: nls.localize('table_header_type') },
            {
              key: 'error',
              label: nls.localize('table_header_message')
            }
          ],
          nls.localize('lib_retrieve_message_title')
        );

        await executor.run({ data: {}, type: 'CONTINUE' });

        expect(appendLineStub.callCount).to.equal(1);
        expect(appendLineStub.firstCall.args[0]).to.equal(expectedOutput);
      });

      it('should output table of components for successful retrieve', async () => {
        const executor = new TestRetrieve();
        const mockRetrieveResult = new RetrieveResult(
          {
            status: RequestStatus.Succeeded
          } as MetadataApiRetrieveStatus,
          new ComponentSet()
        );
        executor.startStub.resolves(mockRetrieveResult);

        const fileResponses = [
          {
            fullName: 'MyClass',
            type: 'ApexClass',
            filePath: join('project', packageDir, 'MyClass.cls')
          },
          {
            fullName: 'MyClass',
            type: 'ApexClass',
            filePath: join('project', packageDir, 'MyClass.cls')
          },
          {
            fullName: 'MyLayout',
            type: 'Layout',
            filePath: join('project', packageDir, 'MyLayout.layout-meta.xml')
          }
        ];
        sb.stub(mockRetrieveResult, 'getFileResponses').returns(fileResponses);

        const formattedRows = fileResponses.map(r => ({
          fullName: r.fullName,
          type: r.type,
          filePath: r.filePath.replace(`project${sep}`, '')
        }));
        const expectedOutput = new Table().createTable(
          formattedRows,
          [
            { key: 'fullName', label: nls.localize('table_header_full_name') },
            { key: 'type', label: nls.localize('table_header_type') },
            {
              key: 'filePath',
              label: nls.localize('table_header_project_path')
            }
          ],
          nls.localize(`lib_retrieve_result_title`)
        );

        await executor.run({ data: {}, type: 'CONTINUE' });

        expect(appendLineStub.calledOnce).to.equal(true);
        expect(appendLineStub.firstCall.args[0]).to.equal(expectedOutput);
      });

      it('should output table of components for failed retrieve', async () => {
        const executor = new TestRetrieve();
        const mockRetrieveResult = new RetrieveResult(
          {
            status: RequestStatus.Failed
          } as MetadataApiRetrieveStatus,
          new ComponentSet()
        );
        executor.startStub.resolves(mockRetrieveResult);

        const fileResponses = [
          {
            fullName: 'MyClass',
            type: 'ApexClass',
            state: ComponentStatus.Failed,
            error: 'There was problem with this component',
            problemType: 'Error'
          },
          {
            fullName: 'MyClass',
            type: 'ApexClass',
            state: ComponentStatus.Failed,
            error: 'There was problem with this component',
            problemType: 'Error'
          }
        ];
        sb.stub(mockRetrieveResult, 'getFileResponses').returns(fileResponses);

        const formattedRows = fileResponses.map(r => ({
          fullName: r.fullName,
          type: r.type,
          error: r.error
        }));
        const expectedOutput = new Table().createTable(
          formattedRows,
          [
            { key: 'fullName', label: nls.localize('table_header_full_name') },
            { key: 'type', label: nls.localize('table_header_type') },
            {
              key: 'error',
              label: nls.localize('table_header_message')
            }
          ],
          nls.localize('lib_retrieve_message_title')
        );

        await executor.run({ data: {}, type: 'CONTINUE' });

        expect(appendLineStub.calledOnce).to.equal(true);
        expect(appendLineStub.firstCall.args[0]).to.equal(expectedOutput);
      });
    });
  });
});
