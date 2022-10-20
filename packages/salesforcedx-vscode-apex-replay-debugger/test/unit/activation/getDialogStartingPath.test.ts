import { LAST_OPENED_LOG_FOLDER_KEY } from '@salesforce/salesforcedx-apex-replay-debugger/out/src/constants';
import {
  projectPaths
} from '@salesforce/salesforcedx-utils-vscode';
import { getDialogStartingPath } from '../../../src/activation/getDialogStartingPath';
// jest.mock('projectPaths');

describe('getDialogStartingPath', () => {

  it('Should return last opened log folder', () => {
    const testPath = '/Users/kenneth.lewis/Documents/dev/ebikes-lwc/.sfdx/tools/debug/logs';
    const myMock = jest.fn(() => testPath);
    // projectPaths.stateFolder().mockResolvedValue();
    const workspaceStateMock = jest.fn();
    // const mockExtensionContext: any = {workspaceState: {get() { return ''; }}};
    const mockExtensionContext: any = {workspaceState: {get: myMock}};
    const dialogStartingPath = getDialogStartingPath(mockExtensionContext);

    expect(dialogStartingPath).toEqual(testPath);
  });

  it('Should return log folder', async () => {
  });

  it('Should return state folder', async () => {
  });
});
