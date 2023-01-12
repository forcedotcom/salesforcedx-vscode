import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as fs from 'fs';
import { DeployExecutor } from '../../../src/commands/DeployExecutor';
import { WorkspaceContext } from '../../../src/context/workspaceContext';
import { SourceTrackingService } from '../../../src/services';

// jest.mock('../../../src/context/workspaceContext', () => {
//   return {
//     // ...jest.requireActual('../../../src/context/workspaceContext'),
//     getInstance: jest.fn().mockImplementation(() => {
//       return {
//         getConnection: () => {
//           return {} as any;
//         }
//       };
//     })
//   };
// });

const dummyProjectPath = '/a/project/path';
jest.mock('@salesforce/source-deploy-retrieve', () => {
  return {
    ...jest.requireActual('@salesforce/source-deploy-retrieve'),
    ComponentSet: jest.fn().mockImplementation(() => {
      return {
        deploy: jest.fn()
      };
    })
  };
});

jest.mock('@salesforce/salesforcedx-utils-vscode', () => {
  return {
    ...jest.requireActual('@salesforce/salesforcedx-utils-vscode'),
    getRootWorkspacePath: () => dummyProjectPath,
    ChannelService: jest.fn().mockImplementation(() => {
      return {};
    }),
    TelemetryService: { getInstance: jest.fn() },
    TelemetryBuilder: jest.fn()
  };
});
jest.mock('../../../src/messages', () => {
  return { loadMessageBundle: jest.fn(), nls: { localize: jest.fn() } };
});

describe('Deploy Executor', () => {
  const dummyProcessCwd = '/';
  beforeEach(async () => {
    jest.spyOn(process, 'cwd').mockReturnValue(dummyProcessCwd);
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const workspaceSpy = jest.spyOn(WorkspaceContext, 'getInstance');
    const mockWorkspaceContext = { getConnection: jest.fn() } as any;
    workspaceSpy.mockReturnValue(mockWorkspaceContext);
  });

  it('should create an instance of Source Tracking before deploying', async () => {
    class TestDeployExecutor extends DeployExecutor<{}> {
      protected getComponents(
        response: ContinueResponse<{}>
      ): Promise<ComponentSet> {
        return new Promise(resolve => resolve(new ComponentSet()));
      }
    }
    const createSourceTrackingSpy = jest
      .spyOn(SourceTrackingService, 'createSourceTracking')
      .mockResolvedValue();

    const executor = new TestDeployExecutor('testDeploy', 'testDeployLog');
    (executor as any).doOperation(new ComponentSet(), {});
  });
});
