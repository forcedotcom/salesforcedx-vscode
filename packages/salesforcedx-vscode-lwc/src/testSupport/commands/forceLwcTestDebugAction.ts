import { escapeStrForRegex } from 'jest-regex-util';
import * as vscode from 'vscode';
import { getLwcTestRunnerExecutable } from '../testRunner';
import { LwcTestExecutionInfo } from '../types';

import * as path from 'path';

export async function forceLwcTestCaseDebug(data: LwcTestExecutionInfo) {
  const { testUri, testName } = data;
  const { fsPath: testFsPath } = testUri;
  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders[0]
  ) {
    const cwd = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const program = getLwcTestRunnerExecutable(cwd);
    if (program) {
      const args = [
        '--debug',
        '--',
        '--runTestsByPath',
        testFsPath,
        '--testNamePattern',
        `"${escapeStrForRegex(testName)}"`
      ];

      const debugConfiguration: vscode.DebugConfiguration = {
        type: 'node',
        request: 'launch',
        name: 'Debug LWC test(s)',
        cwd,
        program,
        args,
        console: 'integratedTerminal',
        internalConsoleOptions: 'openOnSessionStart',
        port: 9229,
        disableOptimisticBPs: true // https://github.com/facebook/create-react-app/issues/5319
      };
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(testUri);
      await vscode.debug.startDebugging(workspaceFolder, debugConfiguration);
    }
  }
}
