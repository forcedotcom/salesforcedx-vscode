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
import { StreamingClient, StreamingClientInfo } from './streamingClient';

export interface OrgInfo {
  username: string;
  devHubId: string;
  id: string;
  createdBy: string;
  createdDate: string;
  expirationDate: string;
  status: string;
  edition: string;
  orgName: string;
  accessToken: string;
  instanceUrl: string;
  clientId: string;
}

export class StreamingService {
  public static SYSTEM_EVENT_CHANNEL = '/systemTopic/ApexDebuggerSystemEvent';
  public static USER_EVENT_CHANNEL = '/systemTopic/ApexDebuggerEvent';
  public static DEFAULT_TIMEOUT = 14400;
  private static instance: StreamingService;
  private clients: StreamingClient[] = [];

  public static getInstance() {
    if (!StreamingService.instance) {
      StreamingService.instance = new StreamingService();
    }
    return StreamingService.instance;
  }

  public getClients(): StreamingClient[] {
    return this.clients;
  }

  public async subscribe(
    project: string,
    clientInfos: StreamingClientInfo[]
  ): Promise<boolean> {
    const orgInfo = await this.getOrgInfo(project);
    const apiVersion = '41.0';
    const instanceUrl = orgInfo.instanceUrl;
    const urlElements = [instanceUrl, 'cometd', apiVersion];
    const streamUrl = urlElements.join('/');

    for (const clientInfo of clientInfos) {
      const streamingClient = new StreamingClient(
        streamUrl,
        orgInfo.accessToken,
        clientInfo
      );
      this.clients.push(streamingClient);
    }

    for (const client of this.clients) {
      await client.subscribe();
    }
    return Promise.resolve(this.isReady());
  }

  public disconnect(): void {
    for (const client of this.clients) {
      client.disconnect();
    }
    this.clients = [];
  }

  public isReady(): boolean {
    if (this.clients && this.clients.length > 0) {
      for (const client of this.clients) {
        if (!client.isConnected()) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

  public async getOrgInfo(projectDir: string): Promise<OrgInfo> {
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force:org:display')
        .withArg('--json')
        .build(),
      { cwd: projectDir }
    ).execute();

    return this.getCmdResult(execution);
  }

  private async getCmdResult(execution: CommandExecution): Promise<OrgInfo> {
    const outputHolder = new CommandOutput();
    execution.stderrSubject.subscribe(data =>
      outputHolder.setStdErr(data.toString())
    );
    execution.stdoutSubject.subscribe(data =>
      outputHolder.setStdOut(data.toString())
    );

    return new Promise<OrgInfo>((resolve, reject) => {
      execution.processExitSubject.subscribe(data => {
        if (data != undefined && data.toString() === '0') {
          try {
            const cmdResult = JSON.parse(outputHolder.getStdOut());
            if (cmdResult && cmdResult.result) {
              const orgInfo = cmdResult.result as OrgInfo;
              return resolve(orgInfo);
            }
            // tslint:disable-next-line:no-empty
          } catch (e) {
            reject(outputHolder.getStdOut());
          }
        } else {
          reject(outputHolder.getStdErr());
        }
      });
    });
  }
}
