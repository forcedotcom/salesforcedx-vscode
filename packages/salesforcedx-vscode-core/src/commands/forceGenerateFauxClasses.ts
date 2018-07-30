/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SObjectCategory } from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/describe';
import { FauxClassGenerator } from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/generator';
import {
  Command,
  LocalCommandExecution,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';
import { nls } from '../messages';
import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

class ForceGenerateFauxClassesExecutor extends SfdxCommandletExecutor<{}> {
  private static isActive = false;
  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_sobjects_refresh'))
      .withArg('sobject definitions refresh')
      .build();
  }

  public async execute(response: ContinueResponse<{}>): Promise<void> {
    if (ForceGenerateFauxClassesExecutor.isActive) {
      vscode.window.showErrorMessage(
        nls.localize('force_sobjects_no_refresh_if_already_active_error_text')
      );
      return;
    }
    ForceGenerateFauxClassesExecutor.isActive = true;
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new LocalCommandExecution(this.build(response.data));

    this.attachExecution(execution, cancellationTokenSource, cancellationToken);

    const projectPath: string = vscode.workspace.rootPath as string;
    const gen: FauxClassGenerator = new FauxClassGenerator(
      execution.cmdEmitter,
      cancellationToken
    );

    try {
      const result = await gen.generate(projectPath, SObjectCategory.ALL);
      console.log('Generate success ' + result);
    } catch (e) {
      console.log('Generate error ' + e);
    }
    ForceGenerateFauxClassesExecutor.isActive = false;
    return;
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();

export async function forceGenerateFauxClassesCreate(explorerDir?: any) {
  const parameterGatherer = new EmptyParametersGatherer();
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceGenerateFauxClassesExecutor()
  );
  await commandlet.run();
}
