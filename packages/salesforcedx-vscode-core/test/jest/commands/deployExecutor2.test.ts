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
  const workspaceContextGetInstanceSpy = jest.spyOn(
    WorkspaceContext,
    'getInstance'
  );
  const mockWorkspaceContext = { getConnection: jest.fn() } as any;
  const createSourceTrackingSpy = jest.spyOn(
    SourceTrackingService,
    'createSourceTracking'
  );
  const dummyComponentSet = new ComponentSet();
  const deploySpy = jest.spyOn(dummyComponentSet, 'deploy');

  class TestDeployExecutor extends DeployExecutor<{}> {
    protected getComponents(
      response: ContinueResponse<{}>
    ): Promise<ComponentSet> {
      return new Promise(resolve => resolve(new ComponentSet()));
    }
  }

  beforeEach(async () => {
    jest.spyOn(process, 'cwd').mockReturnValue(dummyProcessCwd);
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    workspaceContextGetInstanceSpy.mockReturnValue(mockWorkspaceContext);
    createSourceTrackingSpy.mockResolvedValue();
    deploySpy.mockResolvedValue({ pollStatus: jest.fn() } as any);
  });

  it('should create Source Tracking before deploying', async () => {
    // Arrange
    const executor = new TestDeployExecutor('testDeploy', 'testDeployLog');
    (executor as any).setupCancellation = jest.fn();

    // Act
    await (executor as any).doOperation(dummyComponentSet, {});

    // Assert
    expect(createSourceTrackingSpy).toHaveBeenCalled();
    expect(deploySpy).toHaveBeenCalled();
    const createSourceTrackingCallOrder =
      createSourceTrackingSpy.mock.invocationCallOrder[0];
    const deployCallOrder = deploySpy.mock.invocationCallOrder[0];
    expect(createSourceTrackingCallOrder).toBeLessThan(deployCallOrder);
  });
});
