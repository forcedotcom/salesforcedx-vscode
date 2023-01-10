import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/src';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { DeployExecutor } from '../../../src/commands/DeployExecutor';
import { WorkspaceContext } from '../../../src/context/workspaceContext';

jest.mock('../../../src/context/workspaceContext', () => {
  return { getInstance: jest.fn() };
});
describe('Deploy Executor', () => {
  beforeEach(async () => {
    // jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({} as any);
  });

  it('should create an instance of Source Tracking before deploying', async () => {
    class TestDeployExecutor extends DeployExecutor<{}> {
      protected getComponents(
        response: ContinueResponse<{}>
      ): Promise<ComponentSet> {
        return new Promise(resolve => resolve(new ComponentSet()));
      }
    }
    const executor = new TestDeployExecutor('testDeploy', 'testDeployLog');
    (executor as any).doOperation();
    // await executor.run({ data: {}, type: 'CONTINUE' });

    // const executor = new LibraryDeploySourcePathExecutor();
    // const filePath1 = path.join('classes', 'MyClass1.cls');
    // const filePath2 = path.join('classes', 'MyClass2.cls');
    // const filePath3 = path.join('lwc', 'myBundle', 'myBundle');

    // await executor.run({
    //   type: 'CONTINUE',
    //   data: [filePath1, filePath2, filePath3]
    // });
  });
});
