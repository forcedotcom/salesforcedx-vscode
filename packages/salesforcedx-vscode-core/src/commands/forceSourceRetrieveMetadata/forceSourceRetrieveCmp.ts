/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  CliCommandExecutor,
  Command,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  ContinueResponse,
  LocalComponent
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as path from 'path';
import * as vscode from 'vscode';
import { RetrieveDescriber, RetrieveMetadataTrigger } from '.';
import { CommandExecution } from '../../../../salesforcedx-utils-vscode/out/src/cli/commandExecutor';
import { channelService } from '../../channels';
import { nls } from '../../messages';
import { notificationService, ProgressNotification } from '../../notifications';
import { taskViewService } from '../../statuses';
import { TelemetryData } from '../../telemetry';
import { getRootWorkspacePath, MetadataDictionary } from '../../util';
import {
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '../util';
import { RetrieveComponentOutputGatherer } from '../util/parameterGatherers';
import { OverwriteComponentPrompt } from '../util/postconditionCheckers';

export class ForceSourceRetrieveExecutor extends SfdxCommandletExecutor<
  LocalComponent[]
> {
  private describer: RetrieveDescriber;
  private openAfterRetrieve: boolean = false;
  constructor(
    describer: RetrieveDescriber,
    openAfterRetrieve: boolean = false
  ) {
    super();
    this.describer = describer;
    this.openAfterRetrieve = openAfterRetrieve;
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

    const result = await new CommandOutput().getCmdResult(execution);
    const resultJson = JSON.parse(result);
    if (resultJson.status === 0 && this.openAfterRetrieve) {
      const extensions = MetadataDictionary.getInfo(
        resultJson.result.inboundFiles[0].type
      )?.extensions;

      resultJson.result.inboundFiles.map( async (item: any) => {
        let fileToOpen;
        if (extensions?.includes( '.' + item.filePath.split('.').slice(-1) )) {
          fileToOpen = path.join(
            getRootWorkspacePath(),
            item.filePath
          );
          const showOptions: TextDocumentShowOptions = { preview: false};
          const document = await vscode.workspace.openTextDocument(fileToOpen);
          vscode.window.showTextDocument(document, showOptions);
        }
      }
      );
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
  openAfterRetrieve: boolean = false
) {
  const retrieveDescriber = trigger.describer();
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new RetrieveComponentOutputGatherer(retrieveDescriber),
    new ForceSourceRetrieveExecutor(retrieveDescriber, openAfterRetrieve),
    new OverwriteComponentPrompt()
  );
  await commandlet.run();
}

export type TextDocumentShowOptions = {
  preserveFocus?: boolean;
  preview?: boolean
};

export type MetadataResponse = {
  fileName: string;
  outputdir: string;
  suffix: string;
  type: string
};
