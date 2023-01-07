import { componentUtil } from '@salesforce/lightning-lsp-common';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import {
  ComponentSet,
  MetadataApiDeploy,
  MetadataApiRetrieve
} from '@salesforce/source-deploy-retrieve';
import { CancellationTokenSource } from 'vscode';
import * as vscode from 'vscode';
import {
  DeployRetrieveExecutor,
  RetrieveExecutor
} from '../../../src/commands/baseDeployRetrieve';
import { DeployExecutor } from '../../../src/commands/DeployExecutor';

// todo: mock Source Tracking Service and confirm that it creates Source Tracking
// instance before componentSet.deploy/retrieve are called inside Deploy/Retrieve Executors

// Currently getting:
/*
  ● Test suite failed to run

    TypeError: Class extends value undefined is not a constructor or null

      397 | ) => Promise<void>;
      398 |
    > 399 | export class MetadataCacheExecutor extends RetrieveExecutor<string> {
*/

type DeployRetrieveOperation = MetadataApiDeploy | MetadataApiRetrieve;

describe('baseDeployRetrieve', () => {
  beforeEach(() => {});

  // Grabbed this from the baseDeployRetrieve integration tests, trying to
  // modify to use jest
  class TestDeploy extends DeployExecutor<{}> {
    public components: ComponentSet;
    public getComponentsStub = jest.fn().mockReturnValue(new ComponentSet());
    public pollStatusStub: jest.SpyInstance;
    public deployStub: jest.SpyInstance;
    public cancellationStub = jest.fn();

    constructor(toDeploy = new ComponentSet()) {
      super('test', 'testlog');
      this.components = toDeploy;
      this.pollStatusStub = jest.fn();
      this.deployStub = jest
        .spyOn(this.components as any, 'deploy')
        .mockResolvedValue({ pollStatus: this.pollStatusStub });
    }

    protected async getComponents(
      response: ContinueResponse<{}>
    ): Promise<ComponentSet> {
      return this.components;
    }

    // Todo: can we mock vscode so we dont have to import it?
    protected async setupCancellation(
      operation: DeployRetrieveOperation | undefined,
      token?: vscode.CancellationToken
    ) {
      return this.cancellationStub;
    }
  }

  describe('Deploy Executor', () => {
    it('should create an instance of Source Tracking before deploying', async () => {
      // Trying to find a simple way to execute the doOperation function on each of these
      // executors and confirm that source tracking is now created

      // class TestDeployExecutor<T> extends DeployExecutor<T> {
      //   protected getComponents(
      //     response: ContinueResponse<T>
      //   ): Promise<ComponentSet> {
      //     throw new Error('Method not implemented.');
      //   }
      // }

      // const testDeployExecutor = new TestDeployExecutor(
      //   'testExecution',
      //   'testLog'
      // );
      // const cancel = new CancellationTokenSource();
      // (testDeployExecutor as any).doOperation(new ComponentSet(), cancel.token);

      const executor = new TestDeploy();
      // await executor.run(new ComponentSet(), 'testLog');
      await executor.run({ data: {}, type: 'CONTINUE' });
    });
  });

  describe('Retrieve Executor', () => {
    it('should create an instance of Source Tracking before retrieving', async () => {});
  });
});
