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
import fs = require('fs');
import { nls } from '../messages';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

function getDirs(srcPath: string) {
  return fs
    .readdirSync(srcPath)
    .map(name => path.join(srcPath, name))
    .filter(source => fs.lstatSync(source).isDirectory());
}

function flatten(lists: string[][]) {
  return lists.reduce((a, b) => a.concat(b), []);
}

function getDirsRecursive(srcPath: string): string[] {
  return [
    srcPath,
    ...flatten(getDirs(srcPath).map(src => getDirsRecursive(src)))
  ];
}

class SelectFilePath implements ParametersGatherer<{}> {
  public async gather(): Promise<CancelResponse | ContinueResponse<{}>> {
    const rootPath = vscode.workspace.rootPath ? vscode.workspace.rootPath : '';
    const fileNameInputOptions = <vscode.InputBoxOptions>{
      prompt: 'Please enter desired filename'
    };
    const dirs = getDirsRecursive(rootPath);

    const template = await vscode.window.showQuickPick([
      'DefaultApexClass',
      'ApexException',
      'ApexUnitTest',
      'InboundEmailService'
    ]);
    const fileName = await vscode.window.showInputBox(fileNameInputOptions);
    const outputdir = await vscode.window.showQuickPick(dirs);

    return template && fileName && outputdir
      ? { type: 'CONTINUE', data: { template, fileName, outputdir } }
      : { type: 'CANCEL' };
  }
}

class ForceCreateApexExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: {
    template: string;
    fileName: string;
    outputdir: string;
  }): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_create_apex_text'))
      .withArg('force:apex:class:create')
      .withFlag('--classname', data.fileName)
      .withFlag('--template', data.template)
      .withFlag('--outputdir', data.outputdir)
      .build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new SelectFilePath();

export async function forceCreateApex(dir?: any) {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceCreateApexExecutor()
  );
  commandlet.run();
}
