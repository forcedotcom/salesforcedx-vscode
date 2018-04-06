/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { RequestService } from '../commands';

export class SessionService {
  private userFilter: string;
  private requestFilter: string;
  private entryFilter: string;
  private project: string;
  private sessionId: string;
  private connected = false;
  private readonly requestService: RequestService;

  constructor(requestService: RequestService) {
    this.requestService = requestService;
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

  public async start(): Promise<string> {
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
      {
        cwd: this.project,
        env: this.requestService.getEnvVars()
      }
    ).execute();

    const cmdOutput = new CommandOutput();
    const result = await cmdOutput.getCmdResult(execution);
    try {
      const sessionId = JSON.parse(result).result.id as string;
      if (this.isApexDebuggerSessionId(sessionId)) {
        this.sessionId = sessionId;
        this.connected = true;
        return Promise.resolve(this.sessionId);
      } else {
        this.sessionId = '';
        this.connected = false;
        return Promise.reject(result);
      }
    } catch (e) {
      return Promise.reject(result);
    }
  }

  public async stop(): Promise<string> {
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force:data:record:update')
        .withFlag('--sobjecttype', 'ApexDebuggerSession')
        .withFlag('--sobjectid', this.sessionId)
        .withFlag('--values', "Status='Detach'")
        .withArg('--usetoolingapi')
        .withArg('--json')
        .build(),
      { cwd: this.project, env: this.requestService.getEnvVars() }
    ).execute();
    const cmdOutput = new CommandOutput();
    const result = await cmdOutput.getCmdResult(execution);
    try {
      const sessionId = JSON.parse(result).result.id as string;
      if (this.isApexDebuggerSessionId(sessionId)) {
        this.sessionId = '';
        this.connected = false;
        return Promise.resolve(sessionId);
      } else {
        this.connected = true;
        return Promise.reject(result);
      }
    } catch (e) {
      return Promise.reject(result);
    }
  }

  public forceStop(): void {
    this.sessionId = '';
    this.connected = false;
  }
}
