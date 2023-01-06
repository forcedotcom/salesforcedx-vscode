import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { CancellationTokenSource } from 'vscode';
import { DeployExecutor } from '../../../src/commands/baseDeployRetrieve';

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

describe('baseDeployRetrieve', () => {
  beforeEach(() => {});

  describe('Deploy Executor', () => {
    it('should create an instance of Source Tracking before deploying', async () => {
      // Trying to find a simple way to execute the doOperation function on each of these
      // executors and confirm that source tracking is now created
      class TestDeployExecutor<T> extends DeployExecutor<T> {
        protected getComponents(
          response: ContinueResponse<T>
        ): Promise<ComponentSet> {
          throw new Error('Method not implemented.');
        }
      }

      const testDeployExecutor = new TestDeployExecutor(
        'testExecution',
        'testLog'
      );
      const cancel = new CancellationTokenSource();
      (testDeployExecutor as any).doOperation(new ComponentSet(), cancel.token);
    });
  });

  describe('Retrieve Executor', () => {
    it('should create an instance of Source Tracking before retrieving', async () => {});
  });
});
