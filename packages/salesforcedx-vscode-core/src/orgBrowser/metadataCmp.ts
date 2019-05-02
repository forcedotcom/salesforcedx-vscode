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
import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '../commands';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { taskViewService } from '../statuses';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath, hasRootWorkspace, OrgAuthInfo } from '../util';

export class ForceListMetadataExecutor extends SfdxCommandletExecutor<string> {
  private metadataType: string;
  private outputPath: string;
  private defaultUsernameOrAlias: string;

  public constructor(
    metadataType: string,
    outputPath: string,
    defaultUsernameOrAlias: string
  ) {
    super();
    this.metadataType = metadataType;
    this.outputPath = outputPath;
    this.defaultUsernameOrAlias = defaultUsernameOrAlias;
  }

  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withArg('force:mdapi:listmetadata')
      .withFlag('-m', this.metadataType)
      .withFlag('-u', this.defaultUsernameOrAlias)
      .withFlag('-f', this.outputPath)
      .withJson()
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
      buildComponentsList(this.outputPath, this.metadataType);
    });
    notificationService.reportExecutionError(
      execution.command.toString(),
      (execution.stderrSubject as any) as Observable<Error | undefined>
    );
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export async function forceListMetadata(
  metadataType: string,
  defaultUsernameOrAlias: string
) {
  const outputPath = await getComponentsPath(
    metadataType,
    defaultUsernameOrAlias
  );
  const describeExecutor = new ForceListMetadataExecutor(
    metadataType,
    outputPath,
    defaultUsernameOrAlias
  );
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    describeExecutor
  );
  await commandlet.run();
}

export async function getComponentsPath(
  metadataType: string,
  defaultUsernameOrAlias: string
): Promise<string> {
  if (hasRootWorkspace()) {
    try {
      const workspaceRootPath = getRootWorkspacePath();
      const username = await OrgAuthInfo.getUsername(defaultUsernameOrAlias);
      const componentsPath = path.join(
        workspaceRootPath,
        '.sfdx',
        'orgs',
        username,
        'metadata',
        metadataType + '.json'
      );
      return componentsPath;
    } catch (e) {
      telemetryService.sendError(e);
      throw new Error(e);
    }
  } else {
    const err = nls.localize('cannot_determine_workspace');
    telemetryService.sendError(err);
    throw new Error(err);
  }
}

export function buildComponentsList(
  componentsPath: string,
  metadataType: string
): string[] {
  try {
    const fileData = JSON.parse(fs.readFileSync(componentsPath, 'utf8'));
    const metaComponents = [];
    for (const component of fileData) {
      if (!isNullOrUndefined(component.fullName)) {
        metaComponents.push(component.fullName);
      }
    }
    telemetryService.sendEventData(
      'Metadata Components quantity',
      { metadataType },
      { metadataComponents: metaComponents.length }
    );
    return metaComponents;
  } catch (e) {
    throw e;
  }
}
