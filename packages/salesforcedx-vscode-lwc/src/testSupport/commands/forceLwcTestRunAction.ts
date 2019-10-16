/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Command,
  CommandBuilder,
  TestRunner
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { escapeStrForRegex } from 'jest-regex-util';
import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import {
  normalizeRunTestsByPath,
  SfdxWorkspaceLwcTestRunnerInstallationChecker
} from '../testRunner';
import { LwcTestExecutionInfo } from '../types';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const SfdxCommandlet = sfdxCoreExports.SfdxCommandlet;
const SfdxCommandletExecutor = sfdxCoreExports.SfdxCommandletExecutor;
const CompositePreconditionChecker =
  sfdxCoreExports.CompositePreconditionChecker;
const SfdxWorkspaceChecker = sfdxCoreExports.SfdxWorkspaceChecker;
const EmptyParametersGatherer = sfdxCoreExports.EmptyParametersGatherer;

export class ForceLwcTestRunCodeActionExecutor extends SfdxCommandletExecutor<{}> {
  protected builder: CommandBuilder;
  public constructor(
    sfdxProjectPath: string,
    testFsPath: string,
    testName: string
  ) {
    super();
    const lwcTestRunnerExcutable = path.join(
      sfdxProjectPath,
      'node_modules',
      '.bin',
      'lwc-jest'
    );
    this.sfdxProjectPath = sfdxProjectPath;
    this.builder = new CommandBuilder(lwcTestRunnerExcutable);
    this.testFsPath = testFsPath;
    this.testName = testName;
  }

  public build(data: {}): Command {
    this.builder = this.builder
      .withDescription(nls.localize('force_lwc_test_run_description_text'))
      .withArg('--')
      .withArg('--runTestsByPath')
      .withArg(normalizeRunTestsByPath(this.sfdxProjectPath, this.testFsPath))
      .withArg('--testNamePattern')
      .withArg(`"${escapeStrForRegex(this.testName)}"`)
      .withLogName('force_lwc_test_run_action');
    return this.builder.build();
  }
}

export async function forceLwcTestRun(
  sfdxProjectPath: string,
  testFsPath: string,
  testName: string
) {
  const commandlet = new SfdxCommandlet(
    new CompositePreconditionChecker(
      new SfdxWorkspaceChecker(),
      new SfdxWorkspaceLwcTestRunnerInstallationChecker()
    ),
    new EmptyParametersGatherer(),
    new ForceLwcTestRunCodeActionExecutor(sfdxProjectPath, testFsPath, testName)
  );
  await commandlet.run();
}

export function forceLwcTestCaseRun(data: {
  testExecutionInfo: LwcTestExecutionInfo;
}) {
  const { testExecutionInfo } = data;
  const { testUri, testName } = testExecutionInfo;
  const { fsPath: testFsPath } = testUri;
  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders[0]
  ) {
    const cwd = vscode.workspace.workspaceFolders[0].uri.fsPath;
    return forceLwcTestRun(cwd, testFsPath, testName);
  }
}
