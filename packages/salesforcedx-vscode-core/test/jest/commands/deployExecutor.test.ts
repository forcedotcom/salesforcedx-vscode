import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { DeployExecutor } from '../../../src/commands/DeployExecutor';
import { WorkspaceContext } from '../../../src/context/workspaceContext';
import { SourceTrackingService } from '../../../src/services';

jest.mock('../../../src/services/SourceTrackingService');
const sourceTrackingServiceMocked = jest.mocked(SourceTrackingService);

jest.mock('../../../src/context/workspaceContext');
const workspaceContextMocked = jest.mocked(WorkspaceContext);

describe('Deploy Executor', () => {
  // Current failure:
  /*
  FAIL  packages/salesforcedx-vscode-core/test/jest/commands/deployExecutor.test.ts
  ● Test suite failed to run

    TypeError: Cannot read properties of undefined (reading 'getInstance')

      14 | } from './workspaceOrgType';
      15 |
    > 16 | export const workspaceContext = WorkspaceContext.getInstance();
    */

  beforeEach(() => {
    (SourceTrackingService.prototype as any).createSourceTracking.mockResolvedValue(
      sourceTrackingServiceMocked
    );
    (WorkspaceContext as any).getInstance.mockReturnValue(
      workspaceContextMocked
    );
    // (WorkspaceContext.prototype as any).getConnection = jest.fn();
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

    executor.run({ data: {}, type: 'CONTINUE' });
  });
});
