/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

<<<<<<< HEAD
=======
import {
  CliCommandExecutor,
  CommandExecution,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
>>>>>>> Refactor commandOutput into common class in utils
import { StreamingClient, StreamingClientInfo } from './streamingClient';

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
    projectPath: string,
    instanceUrl: string,
    accessToken: string,
    clientInfos: StreamingClientInfo[]
  ): Promise<boolean> {
    const apiVersion = '41.0';
    const urlElements = [instanceUrl, 'cometd', apiVersion];
    const streamUrl = urlElements.join('/');

    for (const clientInfo of clientInfos) {
      const streamingClient = new StreamingClient(
        streamUrl,
        accessToken,
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
<<<<<<< HEAD
=======

  public async getOrgInfo(projectPath: string): Promise<OrgInfo> {
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force:org:display')
        .withArg('--json')
        .build(),
      { cwd: projectPath }
    ).execute();

    const output = new CommandOutput();
    return output.getCmdResult(execution);
  }

  private async getCmdResult(execution: CommandExecution): Promise<OrgInfo> {
    const outputHolder = new CommandOutput();
    execution.stderrSubject.subscribe(data =>
      outputHolder.setStdErr(data.toString())
    );
    execution.stdoutSubject.subscribe(data =>
      outputHolder.setStdOut(data.toString())
    );

    return new Promise<
      OrgInfo
    >(
      (
        resolve: (result: OrgInfo) => void,
        reject: (reason: string) => void
      ) => {
        execution.processExitSubject.subscribe(data => {
          if (data != undefined && data.toString() === '0') {
            try {
              const cmdResult = JSON.parse(outputHolder.getStdOut());
              if (cmdResult && cmdResult.result) {
                const orgInfo = cmdResult.result as OrgInfo;
                return resolve(orgInfo);
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
>>>>>>> Refactor commandOutput into common class in utils
}
