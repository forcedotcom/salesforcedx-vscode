import {
  ContinueResponse,
  getRootWorkspacePath
} from '@salesforce/salesforcedx-utils-vscode';
import { ChannelService } from '@salesforce/salesforcedx-utils-vscode';
// import { nls } from '@salesforce/salesforcedx-utils-vscode/src/messages';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { DeployExecutor } from '../../../src/commands/DeployExecutor';
import { WorkspaceContext } from '../../../src/context/workspaceContext';
import { nls } from '../../../src/messages';

jest.mock('../../../src/context/workspaceContext', () => {
  return { getInstance: jest.fn() };
});

const dummyProjectPath = '/a/project/path';
jest.mock('@salesforce/salesforcedx-utils-vscode', () => {
  return {
    getRootWorkspacePath: () => dummyProjectPath,
    ChannelService: jest.fn().mockImplementation(() => {
      return {};
    })
  };
});
// jest.mock('@salesforce/salesforcedx-utils-vscode', () => {
//   return {
//     getRootWorkspacePath: () => dummyProjectPath
//   };
// });
// jest.mock('@salesforce/salesforcedx-utils-vscode/src/messages', () => {});
jest.mock('../../../src/messages', () => {
  return { loadMessageBundle: jest.fn(), nls: { localize: jest.fn() } };
});
// jest.mock('ChannelService', () => {});
// const n = nls;
// vscode.window.createOutputChannel = jest.fn();
// jest.mock('@salesforce/salesforcedx-utils-vscode', () => {
//   return { channelService: () => dummyProjectPath };
// });
describe('Deploy Executor', () => {
  const dummyProcessCwd = '/';

  beforeEach(async () => {
    jest.spyOn(process, 'cwd').mockReturnValue(dummyProcessCwd);
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    // jest
    //   .spyOn(DeployExecutor as any, 'postOperation')
    //   .mockResolvedValue(() => Promise.resolve());
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
