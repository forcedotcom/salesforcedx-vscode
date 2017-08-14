/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  CommandExecution,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { CommandOutput } from '../utils/commandOutput';

export class SessionService {
  private static instance: SessionService;
  private userFilter: string;
  private requestFilter: string;
  private entryFilter: string;
  private project: string;
  private sessionId: string;
  private connected = false;

  public static getInstance() {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  public withUserFilter(filter?: string): SessionService {
    this.userFilter = filter || '';
    return this;
  }

  public withRequestFilter(filter?: string): SessionService {
    this.requestFilter = filter || '';
    return this;
  }

  public withEntryFilter(filter?: string): SessionService {
    this.entryFilter = filter || '';
    return this;
  }

  public forProject(project?: string): SessionService {
    this.project = project || '';
    return this;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public isApexDebuggerSessionId(id: string): boolean {
    return id != null && id.startsWith('07a');
  }

  public async start(): Promise<CommandOutput> {
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force:data:record:create')
        .withFlag('--sobjecttype', 'ApexDebuggerSession')
        .withFlag(
          '--values',
          `UserIdFilter='${this.userFilter}' EntryPointFilter='${this
            .entryFilter}' RequestTypeFilter='${this.requestFilter}'`
        )
        .withArg('--usetoolingapi')
        .withArg('--json')
        .build(),
      { cwd: this.project }
    ).execute();
    const result = await this.getIdFromCommandResult(execution);
    if (this.isApexDebuggerSessionId(result.getId())) {
      this.sessionId = result.getId();
      this.connected = true;
      return Promise.resolve(result);
    } else {
      this.sessionId = '';
      this.connected = false;
      return Promise.reject(result.getStdOut());
    }
  }

  public async stop(): Promise<CommandOutput> {
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force:data:record:update')
        .withFlag('--sobjecttype', 'ApexDebuggerSession')
        .withFlag('--sobjectid', this.sessionId)
        .withFlag('--values', "Status='Detach'")
        .withArg('--usetoolingapi')
        .withArg('--json')
        .build(),
      { cwd: this.project }
    ).execute();
    const result = await this.getIdFromCommandResult(execution);
    if (this.isApexDebuggerSessionId(result.getId())) {
      this.sessionId = '';
      this.connected = false;
      return Promise.resolve(result);
    } else {
      this.connected = true;
      return Promise.reject(result.getStdOut());
    }
  }

  public forceStop(): void {
    this.sessionId = '';
    this.connected = false;
  }

  private async getIdFromCommandResult(
    execution: CommandExecution
  ): Promise<CommandOutput> {
    const outputHolder = new CommandOutput();
    execution.stderrSubject.subscribe(data =>
      outputHolder.setStdErr(data.toString())
    );
    execution.stdoutSubject.subscribe(data =>
      outputHolder.setStdOut(data.toString())
    );

    return new Promise<
      CommandOutput
    >(
      (
        resolve: (result: CommandOutput) => void,
        reject: (reason: string) => void
      ) => {
        execution.processExitSubject.subscribe(data => {
          if (data != undefined && data.toString() === '0') {
            try {
              const respObj = JSON.parse(outputHolder.getStdOut());
              if (respObj && respObj.result && respObj.result.id) {
                outputHolder.setId(respObj.result.id);
                return resolve(outputHolder);
              } else {
                return reject(outputHolder.getStdOut());
              }
            } catch (e) {
              return reject(outputHolder.getStdOut());
            }
          } else {
            return reject(outputHolder.getStdErr());
          }
        });
      }
    );
  }
}
