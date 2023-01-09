import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as path from 'path';
import { LibraryDeploySourcePathExecutor } from '../../../src/commands';
import { DeployExecutor } from '../../../src/commands/DeployExecutor';
import { WorkspaceContext } from '../../../src/context/workspaceContext';
import { SourceTrackingService } from '../../../src/services';
import SfdxProjectConfig from '../../../src/sfdxProject/sfdxProjectConfig';
// import { workspaceContext } from './../../../../salesforcedx-vscode-soql/src/sfdx';

// jest.mock('../../../src/services/SourceTrackingService');
// const sourceTrackingServiceMocked = jest.mocked(SourceTrackingService);

// jest.mock('../../../src/sfdxProject/sfdxProjectConfig', () => {
//   return {
//     getValue: '56.0'
//   };
// });
jest.mock('../../../src/sfdxProject/sfdxProjectConfig');
// const sfdxProjectConfigMocked = jest.mocked(SfdxProjectConfig);

jest.mock('@salesforce/source-deploy-retrieve');
const componentSetMocked = jest.mocked(ComponentSet);
// const workspaceContextMocked = jest.mocked(WorkspaceContext);
// jest.mock('../../../src/context/workspaceContext', () => {
//   return { getInstance: jest.fn() };
// });

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
    // (SourceTrackingService.prototype as any).createSourceTracking.mockResolvedValue(
    //   sourceTrackingServiceMocked
    // );
    // (WorkspaceContext as any).getInstance.mockReturnValue(
    //   workspaceContextMocked
    // );
    // (WorkspaceContext.prototype as any).getConnection = jest.fn();
    // sfdxProjectConfigMocked.mockReturnValue();
    // SfdxProjectConfig.getValue.mockResolvedValue();
    // sfdxProjectConfigMocked
    jest.spyOn(SfdxProjectConfig, 'getValue').mockResolvedValue('56.0');
    jest
      .spyOn(ComponentSet, 'fromSource')
      .mockReturnValue({ sourceApiVersion: '56.0' } as any);
  });

  it('should create an instance of Source Tracking before deploying', async () => {
    // class TestDeployExecutor extends DeployExecutor<{}> {
    //   protected getComponents(
    //     response: ContinueResponse<{}>
    //   ): Promise<ComponentSet> {
    //     return new Promise(resolve => resolve(new ComponentSet()));
    //   }
    // }
    // const executor = new TestDeployExecutor('testDeploy', 'testDeployLog');
    // await executor.run({ data: {}, type: 'CONTINUE' });

    const executor = new LibraryDeploySourcePathExecutor();
    const filePath1 = path.join('classes', 'MyClass1.cls');
    const filePath2 = path.join('classes', 'MyClass2.cls');
    const filePath3 = path.join('lwc', 'myBundle', 'myBundle');

    await executor.run({
      type: 'CONTINUE',
      data: [filePath1, filePath2, filePath3]
    });
  });
});
