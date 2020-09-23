/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Command,
  SfdxCommandBuilder,
  CliCommandExecutor,
  CommandOutput
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  ContinueResponse,
  LocalComponent
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { RetrieveDescriber, RetrieveMetadataTrigger } from '.';
import { nls } from '../../messages';
import { TelemetryData } from '../../telemetry';
import {
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '../util';
import { getRootWorkspacePath } from '../../util';
import { CommandExecution } from '../../../../salesforcedx-utils-vscode/out/src/cli/commandExecutor';
import { RetrieveComponentOutputGatherer } from '../util/parameterGatherers';
import { OverwriteComponentPrompt } from '../util/postconditionCheckers';
import { channelService } from '../../channels';
import { notificationService, ProgressNotification } from '../../notifications';
import { taskViewService } from '../../statuses';
import * as vscode from 'vscode';
import * as path from 'path';

export class ForceSourceRetrieveExecutor extends SfdxCommandletExecutor<
  LocalComponent[]
> {
  private describer: RetrieveDescriber;
  private OpenAfterRetrieve: boolean = false;
  constructor(
    describer: RetrieveDescriber,
    OpenAfterRetrieve: boolean = false
  ) {
    super();
    this.describer = describer;
    this.OpenAfterRetrieve = OpenAfterRetrieve;
  }

  public build(data?: LocalComponent[]): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_retrieve_text'))
      .withLogName('force_source_retrieve')
      .withArg('force:source:retrieve')
      .withJson()
      .withArg('-m')
      .withArg(this.describer.buildMetadataArg(data))
      .build();
  }

  protected getTelemetryData(
    success: boolean,
    response: ContinueResponse<LocalComponent[]>
  ): TelemetryData {
    const quantities = this.getNumberOfRetrievedTypes(response.data);
    const rows = Object.keys(quantities).map(type => {
      return { type, quantity: quantities[type] };
    });
    return {
      properties: {
        metadataCount: JSON.stringify(rows)
      }
    };
  }

  private getNumberOfRetrievedTypes(data: LocalComponent[]): any {
    const quantities: { [key: string]: number } = {};
    data.forEach(selection => {
      const current = quantities[selection.type];
      quantities[selection.type] = current ? current + 1 : 1;
    });
    return quantities;
  }

  public async execute(response: any): Promise<void> {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response), {
      cwd: getRootWorkspacePath()
    }).execute(cancellationToken);
    this.attachExecution(execution, cancellationTokenSource, cancellationToken);

    //execution.processExitSubject.subscribe(() => {
    //this.logMetric(execution.command.logName, startTime);
    //});

    const result = await new CommandOutput().getCmdResult(execution);
    const resultJson = JSON.parse(result);
    if (resultJson.status === 0 && this.OpenAfterRetrieve) {
      const filePath = path.join(
        getRootWorkspacePath(),
        resultJson.result.inboundFiles[0].filePath
      );
      const document = await vscode.workspace.openTextDocument(filePath);
      vscode.window.showTextDocument(document);
    }
  }

  protected attachExecution(
    execution: CommandExecution,
    cancellationTokenSource: vscode.CancellationTokenSource,
    cancellationToken: vscode.CancellationToken
  ) {
    channelService.streamCommandStartStop(execution);
    notificationService.reportCommandExecutionStatus(
      execution,
      cancellationToken
    );
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

export async function forceSourceRetrieveCmp(
  trigger: RetrieveMetadataTrigger,
  OpenAfterRetrieve: boolean = false
) {
  const retrieveDescriber = trigger.describer();
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new RetrieveComponentOutputGatherer(retrieveDescriber),
    new ForceSourceRetrieveExecutor(retrieveDescriber, OpenAfterRetrieve),
    new OverwriteComponentPrompt()
  );
  await commandlet.run();
}
