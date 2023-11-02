/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode';
import {
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { taskViewService } from '../statuses';
import { workspaceUtils } from '../util';
import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './util';

interface QueryResponse {
  status: number;
  result: QueryResult;
}

interface QueryResult {
  size: number;
  totalSize: number;
  records: QueryRecord[];
}

interface QueryRecord {
  Id: string;
}

export type IdSelection = { id: string };
export class IdGatherer implements ParametersGatherer<IdSelection> {
  private readonly sessionIdToUpdate: string;

  public constructor(sessionIdToUpdate: string) {
    this.sessionIdToUpdate = sessionIdToUpdate;
  }

  public async gather(): Promise<ContinueResponse<IdSelection>> {
    return { type: 'CONTINUE', data: { id: this.sessionIdToUpdate } };
  }
}

export class DebuggerSessionDetachExecutor extends SfdxCommandletExecutor<
  IdSelection
> {
  public build(data: IdSelection): Command {
    return new SfdxCommandBuilder()
      .withArg('data:update:record')
      .withDescription(nls.localize('debugger_stop_text'))
      .withFlag('--sobject', 'ApexDebuggerSession')
      .withFlag('--record-id', data ? data.id : '')
      .withFlag('--values', 'Status="Detach"')
      .withArg('--use-tooling-api')
      .withLogName('force_debugger_stop')
      .build();
  }
}

export class StopActiveDebuggerSessionExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withArg('data:query')
      .withDescription(nls.localize('debugger_query_session_text'))
      .withFlag(
        '--query',
        "SELECT Id FROM ApexDebuggerSession WHERE Status = 'Active' LIMIT 1"
      )
      .withArg('--use-tooling-api')
      .withJson()
      .withLogName('force_debugger_query_session')
      .build();
  }

  public async execute(response: ContinueResponse<{}>): Promise<void> {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: workspaceUtils.getRootWorkspacePath()
    }).execute(cancellationToken);

    const resultPromise = new CommandOutput().getCmdResult(execution);
    execution.processExitSubject.subscribe(() => {
      this.logMetric(execution.command.logName, startTime);
    });
    channelService.streamCommandOutput(execution);
    channelService.showChannelOutput();
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);

    try {
      const result = await resultPromise;
      const queryResponse = JSON.parse(result) as QueryResponse;
      if (
        queryResponse &&
        queryResponse.result &&
        queryResponse.result.size === 1
      ) {
        const sessionIdToUpdate = queryResponse.result.records[0].Id;
        if (sessionIdToUpdate && sessionIdToUpdate.startsWith('07a')) {
          const sessionDetachCommandlet = new SfdxCommandlet(
            new SfdxWorkspaceChecker(),
            new IdGatherer(sessionIdToUpdate),
            new DebuggerSessionDetachExecutor()
          );
          await sessionDetachCommandlet.run();
        }
      } else {
        notificationService.showInformationMessage(
          nls.localize('debugger_stop_none_found_text')
        );
      }
      // tslint:disable-next-line:no-empty
    } catch (e) {}

    return Promise.resolve();
  }
}

export async function debuggerStop() {
  const sessionStopCommandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new EmptyParametersGatherer(),
    new StopActiveDebuggerSessionExecutor()
  );
  await sessionStopCommandlet.run();
}
