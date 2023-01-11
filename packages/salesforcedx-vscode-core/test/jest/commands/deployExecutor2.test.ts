import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as fs from 'fs';
import { DeployExecutor } from '../../../src/commands/DeployExecutor';

jest.mock('../../../src/context/workspaceContext', () => {
  return { getInstance: jest.fn() };
});

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

  beforeEach(async () => {
    jest.spyOn(process, 'cwd').mockReturnValue(dummyProcessCwd);
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
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
  });
});
