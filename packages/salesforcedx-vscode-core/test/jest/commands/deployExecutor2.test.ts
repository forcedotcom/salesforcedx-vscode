import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as fs from 'fs';
import { DeployExecutor } from '../../../src/commands/DeployExecutor';
import { WorkspaceContext } from '../../../src/context/workspaceContext';
import { SourceTrackingService } from '../../../src/services';

const dummyProjectPath = '/a/project/path';
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
  const createSourceTrackingSpy = jest.spyOn(
    SourceTrackingService,
    'createSourceTracking'
  );
  const dummyComponentSet = new ComponentSet();
  const deploySpy = jest.spyOn(dummyComponentSet, 'deploy');

  beforeEach(async () => {
    jest.spyOn(process, 'cwd').mockReturnValue(dummyProcessCwd);
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const workspaceSpy = jest.spyOn(WorkspaceContext, 'getInstance');
    const mockWorkspaceContext = { getConnection: jest.fn() } as any;
    workspaceSpy.mockReturnValue(mockWorkspaceContext);
    createSourceTrackingSpy.mockResolvedValue();
    deploySpy.mockResolvedValue({ pollStatus: jest.fn() } as any);
  });

  it('should create an instance of Source Tracking before deploying', async () => {
    // Arrange
    class TestDeployExecutor extends DeployExecutor<{}> {
      protected getComponents(
        response: ContinueResponse<{}>
      ): Promise<ComponentSet> {
        return new Promise(resolve => resolve(new ComponentSet()));
      }
    }

    const executor = new TestDeployExecutor('testDeploy', 'testDeployLog');
    (executor as any).setupCancellation = jest.fn();

    // Act
    await (executor as any).doOperation(dummyComponentSet, {});

    // Assert
    expect(createSourceTrackingSpy).toHaveBeenCalled();
    // await Promise.resolve();
    expect(deploySpy).toHaveBeenCalled();
    // expect(dummyComponentSet.deploy).toHaveBeenCalled();
  });
});
