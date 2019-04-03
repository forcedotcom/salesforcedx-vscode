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
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
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
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath, hasRootWorkspace, OrgAuthInfo } from '../util';

export class ForceDescribeMetadataExecutor extends SfdxCommandletExecutor<
  string
> {
  private outputPath: string;

  public constructor(outputPath: string) {
    super();
    this.outputPath = outputPath;
  }

  public build(data: {}): Command {
    return new SfdxCommandBuilder()
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
      buildTypesList(this.outputPath);
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

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

// refresh when registering the command or checking to see if server is available initially
export async function forceDescribeMetadata(outputPath?: string) {
  if (isNullOrUndefined(outputPath)) {
    outputPath = await getMetadataTypesPath();
  }
  const describeExecutor = new ForceDescribeMetadataExecutor(outputPath!);
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    describeExecutor
  );
  await commandlet.run();
}

async function getMetadataTypesPath(): Promise<string | undefined> {
  if (hasRootWorkspace()) {
    const workspaceRootPath = getRootWorkspacePath();
    const defaultUsernameOrAlias = await OrgAuthInfo.getDefaultUsernameOrAlias();
    const defaultUsernameIsSet = typeof defaultUsernameOrAlias !== 'undefined';

    if (defaultUsernameIsSet) {
      const username = await OrgAuthInfo.getUsername(defaultUsernameOrAlias!);
      const metadataTypesPath = path.join(
        workspaceRootPath,
        '.sfdx',
        'orgs',
        username,
        'metadata',
        'metadataTypes.json'
      );
      return metadataTypesPath;
    } else {
      const err = nls.localize('error_no_default_username');
      telemetryService.sendError(err);
      throw new Error(err);
    }
  } else {
    const err = nls.localize('cannot_determine_workspace');
    telemetryService.sendError(err);
    throw new Error(err);
  }
}

export type MetadataObject = {
  directoryName: string;
  inFolder: boolean;
  metaFile: boolean;
  suffix: string;
  xmlName: string;
};
// builds the list. saves as a list right now, later should be used to add as child nodes to root node tree
export function buildTypesList(metadataTypesPath: string) {
  if (!isNullOrUndefined(metadataTypesPath)) {
    const fileData = JSON.parse(fs.readFileSync(metadataTypesPath, 'utf8'));
    const metadataObjects = fileData.metadataObjects as MetadataObject[];
    const metadataTypes = [];
    for (const metadataObject of metadataObjects) {
      if (!isNullOrUndefined(metadataObject.xmlName)) {
        metadataTypes.push(metadataObject.xmlName);
      }
    }
  } else {
    const err = nls.localize('There was an error retrieving metadata type information.');
    telemetryService.sendError(err);
    throw new Error(err);
  }
}
// when the default username is updated we should get the file in the background if we don't previously have it
export async function onUsernameChange() {
  const metadataTypesPath = await getMetadataTypesPath();
  if (isNullOrUndefined(metadataTypesPath) || !fs.existsSync(metadataTypesPath)) {
    await forceDescribeMetadata(metadataTypesPath);
  }
}
