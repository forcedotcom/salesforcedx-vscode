/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as fs from 'fs';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import { isNullOrUndefined } from 'util';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '../commands';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { taskViewService } from '../statuses';
import { getRootWorkspacePath, hasRootWorkspace, OrgAuthInfo } from '../util';

export class ForceDescribeMetadataExecutor extends SfdxCommandletExecutor<string> {
  private outputPath: string;

  public constructor(outputPath: string) {
    super();
    this.outputPath = outputPath;
  }

  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(
       'SFDX: Describe Metadata'
      )
      .withArg('force:mdapi:describemetadata')
      .withJson()
      .withFlag('-f', this.outputPath)
      .withLogName('force_describe_metadata')
      .build();
  }

  public execute(response: ContinueResponse<string>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: getRootWorkspacePath()
    }).execute(cancellationToken);

    execution.processExitSubject.subscribe(async data => {
      this.logMetric(execution.command.logName, startTime);
      buildTypeList();
    });
    notificationService.reportExecutionError(
      execution.command.toString(),
      (execution.stderrSubject as any) as Observable<Error | undefined>
    );
    channelService.streamCommandOutput(execution);
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

async function getDirectory(): Promise<string | undefined> {
  if (hasRootWorkspace()) {
    const workspaceRootPath = getRootWorkspacePath();
    const defaultUsernameOrAlias = await getDefaultUsernameOrAlias();
    const defaultUsernameIsSet = typeof defaultUsernameOrAlias !== 'undefined';

    if (defaultUsernameIsSet) {
      const username = await OrgAuthInfo.getUsername(defaultUsernameOrAlias!);
      const metadataTypesPath = path.join(workspaceRootPath, '.sfdx', 'orgs', username, 'metadata', 'metadataTypes.json');
      return metadataTypesPath;
    } else {
      throw new Error(nls.localize('error_no_default_username'));
    }
  } else {
    throw new Error(nls.localize('cannot_determine_workspace'));
  }
}

export async function getDefaultUsernameOrAlias(): Promise<string | undefined> {
  if (hasRootWorkspace()) {
    return await OrgAuthInfo.getDefaultUsernameOrAlias();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export async function forceDescribeMetadata() {
  const outputPath = await getDirectory();
  if (!isNullOrUndefined(outputPath)) {
    const describeExecutor = new ForceDescribeMetadataExecutor(outputPath);
    const commandlet = new SfdxCommandlet(
      workspaceChecker,
      parameterGatherer,
      describeExecutor
    );
    await commandlet.run();
  }

}

export type MetadataObject = {
  directoryName: string;
  inFolder: boolean;
  metaFile: boolean;
  suffix: string;
  xmlName: string;
};

export async function buildTypeList() {
  const filePath = await getDirectory();
  if (!isNullOrUndefined(filePath)) {
    const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const metadataObjects = fileData.metadataObjects;
    const metadataTypes = [];
    for (const index in metadataObjects) {
      if (!isNullOrUndefined(metadataObjects[index].xmlName)) {
        metadataTypes.push(metadataObjects[index].xmlName);
      }
    }
  } else {
    throw new Error('There was an error retrieving metadata type information.');
  }
}
