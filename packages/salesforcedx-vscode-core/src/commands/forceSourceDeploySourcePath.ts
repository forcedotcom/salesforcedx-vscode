/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { SfdxCommandlet, SfdxWorkspaceChecker } from './commands';
import {
  DeployParams,
  DeployParamsGatherer,
  ForceSourceDeployExecutor
} from './forceSourceDeploy';
import { SourcePathDeployChecker } from './forceSourceRetrieveSourcePath';

export class ForceSourceDeploySourcePathExecutor extends ForceSourceDeployExecutor {
  public build(deployParams: DeployParams): Command {
    const commandBuilder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_deploy_text'))
      .withArg('force:source:deploy')
      .withLogName('force_source_deploy_with_sourcepath')
      .withFlag('--sourcepath', deployParams.sourcePaths)
      .withJson();
    return commandBuilder.build();
  }
}

export async function forceSourceDeploySourcePath(sourceUri: vscode.Uri) {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new DeployParamsGatherer(false, [sourceUri]),
    new ForceSourceDeploySourcePathExecutor(),
    new SourcePathDeployChecker()
  );
  await commandlet.run();
}

export async function forceSourceDeployMultipleSourcePaths(uris: vscode.Uri[]) {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new DeployParamsGatherer(false, uris),
    new ForceSourceDeploySourcePathExecutor()
  );
  await commandlet.run();
}
