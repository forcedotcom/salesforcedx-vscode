import { escapeStrForRegex } from 'jest-regex-util';
import * as vscode from 'vscode';
import { getLwcTestRunnerExecutable } from '../testRunner';
import { LwcTestExecutionInfo } from '../types';

export function getDebugConfiguration(
  lwcTestRunnerExecutablePath: string,
  cwd: string,
  testFsPath: string,
  testName: string
): vscode.DebugConfiguration {
  const program = lwcTestRunnerExecutablePath;
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
    disableOptimisticBPs: true
  };
  return debugConfiguration;
}

export async function forceLwcTestCaseDebug(data: LwcTestExecutionInfo) {
  const { testUri, testName } = data;
  const { fsPath: testFsPath } = testUri;
  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders[0]
  ) {
    const cwd = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const lwcTestRunnerExecutablePath = getLwcTestRunnerExecutable(cwd);
    if (lwcTestRunnerExecutablePath) {
      const debugConfiguration = getDebugConfiguration(
        lwcTestRunnerExecutablePath,
        cwd,
        testFsPath,
        testName
      );
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(testUri);
      await vscode.debug.startDebugging(workspaceFolder, debugConfiguration);
    }
  }
}
