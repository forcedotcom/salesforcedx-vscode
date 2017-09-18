/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SObjectCategory } from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/describe';
import { FauxClassGenerator } from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/generator';
import {
  CliCommandExecutor,
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { CancellableStatusBar, taskViewService } from '../statuses';
import {
  ContinueResponse,
  DirFileNameSelection,
  EmptyParametersGatherer,
  SelectDirPath,
  SelectFileName,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

class ForceGenerateFauxClassesExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_force_refresh_sobjects'))
      .build();
  }

  public async execute(response: ContinueResponse<{}>): Promise<void> {
    const projectPath: string = <string>vscode.workspace.rootPath;
    const gen: FauxClassGenerator = new FauxClassGenerator();
    try {
      await gen.generate(projectPath, SObjectCategory.ALL);
    } catch (e) {
      console.log(e);
    }
    return;
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const fileNameGatherer = new SelectFileName();

export async function forceGenerateFauxClassesCreate(explorerDir?: any) {
  const projectDirGatherer = new SelectDirPath(explorerDir, 'classes');
  const parameterGatherer = new EmptyParametersGatherer();
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceGenerateFauxClassesExecutor()
  );
  commandlet.run();
}
