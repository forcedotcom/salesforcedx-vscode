/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CommandOutput, Command, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import {
  CliCommandExecutor,
  workspaceUtils,
  ContinueResponse,
  EmptyParametersGatherer,
  ParametersGatherer,
  ProgressNotification
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { taskViewService } from '../statuses';
import { SfCommandlet, SfCommandletExecutor, SfWorkspaceChecker } from './util';

type QueryResponse = {
  status: number;
  result: QueryResult;
};

type QueryResult = {
  size: number;
  totalSize: number;
  records: QueryRecord[];
};

type QueryRecord = {
  Id: string;
};

type IdSelection = { id: string };
class IdGatherer implements ParametersGatherer<IdSelection> {
  private readonly sessionIdToUpdate: string;

  constructor(sessionIdToUpdate: string) {
    this.sessionIdToUpdate = sessionIdToUpdate;
  }

  public gather(): Promise<ContinueResponse<IdSelection>> {
    return Promise.resolve({ type: 'CONTINUE', data: { id: this.sessionIdToUpdate } });
  }
}

class DebuggerSessionDetachExecutor extends SfCommandletExecutor<IdSelection> {
  public build(data: IdSelection): Command {
    return new SfCommandBuilder()
      .withArg('data:update:record')
      .withDescription(nls.localize('debugger_stop_text'))
      .withFlag('--sobject', 'ApexDebuggerSession')
      .withFlag('--record-id', data ? data.id : '')
      .withFlag('--values', 'Status="Detach"')
      .withArg('--use-tooling-api')
      .withLogName('debugger_stop')
      .build();
  }
}

class StopActiveDebuggerSessionExecutor extends SfCommandletExecutor<{}> {
  public build(data: {}): Command {
    return new SfCommandBuilder()
      .withArg('data:query')
      .withDescription(nls.localize('debugger_query_session_text'))
      .withFlag('--query', "SELECT Id FROM ApexDebuggerSession WHERE Status = 'Active' LIMIT 1")
      .withArg('--use-tooling-api')
      .withJson()
      .withLogName('debugger_query_session')
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
    void ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);

    try {
      const result = await resultPromise;
      // remove when we drop CLI invocations
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const queryResponse = JSON.parse(result) as QueryResponse;
      if (queryResponse && queryResponse.result && queryResponse.result.size === 1) {
        const sessionIdToUpdate = queryResponse.result.records[0].Id;
        if (sessionIdToUpdate && sessionIdToUpdate.startsWith('07a')) {
          const sessionDetachCommandlet = new SfCommandlet(
            new SfWorkspaceChecker(),
            new IdGatherer(sessionIdToUpdate),
            new DebuggerSessionDetachExecutor()
          );
          await sessionDetachCommandlet.run();
        }
      } else {
        void notificationService.showInformationMessage(nls.localize('debugger_stop_none_found_text'));
      }
    } catch {}
  }
}

export const debuggerStop = async () => {
  const sessionStopCommandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new EmptyParametersGatherer(),
    new StopActiveDebuggerSessionExecutor()
  );
  await sessionStopCommandlet.run();
};
