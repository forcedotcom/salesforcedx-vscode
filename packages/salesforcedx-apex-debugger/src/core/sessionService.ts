/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CliCommandExecutor, CommandOutput, RequestService, SfCommandBuilder } from '@salesforce/salesforcedx-utils';

export class SessionService {
  private userFilter?: string;
  private requestFilter?: string;
  private entryFilter?: string;
  private project?: string;
  private sessionId!: string;
  private connected = false;
  private readonly requestService: RequestService;

  constructor(requestService: RequestService) {
    this.requestService = requestService;
  }

  public withUserFilter(filter?: string): SessionService {
    this.userFilter = filter ?? '';
    return this;
  }

  public withRequestFilter(filter?: string): SessionService {
    this.requestFilter = filter ?? '';
    return this;
  }

  public withEntryFilter(filter?: string): SessionService {
    this.entryFilter = filter ?? '';
    return this;
  }

  public forProject(project?: string): SessionService {
    this.project = project ?? '';
    return this;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public isApexDebuggerSessionId(id: string): boolean {
    return id?.startsWith('07a');
  }

  public async start(): Promise<string> {
    const execution = new CliCommandExecutor(
      new SfCommandBuilder()
        .withArg('data:create:record')
        .withFlag('--sobject', 'ApexDebuggerSession')
        .withFlag(
          '--values',
          `UserIdFilter='${this.userFilter}' EntryPointFilter='${this.entryFilter}' RequestTypeFilter='${this.requestFilter}'`
        )
        .withArg('--use-tooling-api')
        .withJson()
        .build(),
      {
        cwd: this.project,
        env: this.requestService.getEnvVars()
      }
    ).execute();

    const cmdOutput = new CommandOutput();
    const result = await cmdOutput.getCmdResult(execution);
    try {
      // won't fix since this pkg is going away
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const sessionId = JSON.parse(result).result.id as string;
      if (this.isApexDebuggerSessionId(sessionId)) {
        this.sessionId = sessionId;
        this.connected = true;
        return this.sessionId;
      } else {
        this.sessionId = '';
        this.connected = false;
        throw result;
      }
    } catch {
      throw result;
    }
  }

  public async stop(): Promise<string> {
    const execution = new CliCommandExecutor(
      new SfCommandBuilder()
        .withArg('data:update:record')
        .withFlag('--sobject', 'ApexDebuggerSession')
        .withFlag('--record-id', this.sessionId)
        .withFlag('--values', "Status='Detach'")
        .withArg('--use-tooling-api')
        .withJson()
        .build(),
      { cwd: this.project, env: this.requestService.getEnvVars() }
    ).execute();
    const cmdOutput = new CommandOutput();
    const result = await cmdOutput.getCmdResult(execution);
    try {
      // won't fix since this pkg is going away
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const sessionId = JSON.parse(result).result.id as string;
      if (this.isApexDebuggerSessionId(sessionId)) {
        this.sessionId = '';
        this.connected = false;
        return sessionId;
      } else {
        this.connected = true;
        throw result;
      }
    } catch {
      throw result;
    }
  }

  public forceStop(): void {
    this.sessionId = '';
    this.connected = false;
  }
}
