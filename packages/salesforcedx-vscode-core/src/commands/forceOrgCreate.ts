/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../messages';
import {
  FileSelection,
  FileSelector,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

class ForceOrgCreateExecutor extends SfdxCommandletExecutor<FileSelection> {
  public build(data: FileSelection): Command {
    const selectionPath = path.relative(
      vscode.workspace.rootPath!, // this is safe because of workspaceChecker
      data.file
    );
    return new SfdxCommandBuilder()
      .withDescription(
        nls.localize('force_org_create_default_scratch_org_text')
      )
      .withArg('force:org:create')
      .withFlag('-f', `${selectionPath}`)
      .withArg('--setdefaultusername')
      .build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new FileSelector('**/*-scratch-def.json');

export function forceOrgCreate() {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceOrgCreateExecutor()
  );
  commandlet.run();
}
