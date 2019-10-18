/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Command,
  CommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import {
  getJestArgs,
  SfdxWorkspaceLwcTestRunnerInstallationChecker
} from '../testRunner';
import { TestExecutionInfo } from '../types';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const SfdxCommandlet = sfdxCoreExports.SfdxCommandlet;
const SfdxCommandletExecutor = sfdxCoreExports.SfdxCommandletExecutor;
const CompositePreconditionChecker =
  sfdxCoreExports.CompositePreconditionChecker;
const SfdxWorkspaceChecker = sfdxCoreExports.SfdxWorkspaceChecker;
const EmptyParametersGatherer = sfdxCoreExports.EmptyParametersGatherer;

class LwcJestCommandBuilder extends CommandBuilder {
  public withArg(arg: string): CommandBuilder {
    this.args.push(arg);
    return this;
  }
}

export class ForceLwcTestRunCodeActionExecutor extends SfdxCommandletExecutor<{}> {
  protected builder: CommandBuilder;
  private testExecutionInfo: TestExecutionInfo;
  public constructor(
    sfdxProjectPath: string,
    testExecutionInfo: TestExecutionInfo
  ) {
    super();
    const lwcTestRunnerExcutable = path.join(
      sfdxProjectPath,
      'node_modules',
      '.bin',
      'lwc-jest'
    );
    this.builder = new LwcJestCommandBuilder(lwcTestRunnerExcutable);
    this.testExecutionInfo = testExecutionInfo;
  }

  public build(data: {}): Command {
    this.builder = this.builder.withDescription(
      nls.localize('force_lwc_test_run_description_text')
    );

    const jestArgs = getJestArgs(this.testExecutionInfo);
    this.builder = jestArgs.reduce((builder, jestArg) => {
      builder.withArg(jestArg);
      return builder;
    }, this.builder);

    this.builder = this.builder.withLogName('force_lwc_test_run_action');
    return this.builder.build();
  }
}

export async function forceLwcTestRun(
  sfdxProjectPath: string,
  testExecutionInfo: TestExecutionInfo
) {
  const commandlet = new SfdxCommandlet(
    new CompositePreconditionChecker(
      new SfdxWorkspaceChecker(),
      new SfdxWorkspaceLwcTestRunnerInstallationChecker()
    ),
    new EmptyParametersGatherer(),
    new ForceLwcTestRunCodeActionExecutor(sfdxProjectPath, testExecutionInfo)
  );
  await commandlet.run();
}

export function forceLwcTestCaseRun(data: {
  testExecutionInfo: TestExecutionInfo;
}) {
  const { testExecutionInfo } = data;
  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders[0]
  ) {
    const cwd = vscode.workspace.workspaceFolders[0].uri.fsPath;
    return forceLwcTestRun(cwd, testExecutionInfo);
  }
}

export function forceLwcTestFileRun(data: {
  testExecutionInfo: TestExecutionInfo;
}) {
  // TODO: refactor this.
  const { testExecutionInfo } = data;
  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders[0]
  ) {
    const cwd = vscode.workspace.workspaceFolders[0].uri.fsPath;
    return forceLwcTestRun(cwd, testExecutionInfo);
  }
}
