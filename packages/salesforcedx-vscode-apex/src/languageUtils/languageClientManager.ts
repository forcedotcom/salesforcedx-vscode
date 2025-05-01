/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { hasRootWorkspace } from '@salesforce/salesforcedx-utils-vscode';
import { execSync } from 'node:child_process';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { ApexLanguageClient } from '../apexLanguageClient';
import ApexLSPStatusBarItem from '../apexLspStatusBarItem';
import { API, DEBUGGER_EXCEPTION_BREAKPOINTS, DEBUGGER_LINE_BREAKPOINTS, SET_JAVA_DOC_LINK } from '../constants';
import * as languageServer from '../languageServer';
import { nls } from '../messages';
import { retrieveEnableSyncInitJobs } from '../settings';
import { getTelemetryService } from '../telemetry/telemetry';
import { ApexLSPConverter, ApexTestMethod, LSPApexTestMethod } from '../views/lspConverter';
import { getTestOutlineProvider } from '../views/testOutlineProvider';

export enum ClientStatus {
  Unavailable,
  Indexing,
  Error,
  Ready
}

export class LanguageClientStatus {
  private status: ClientStatus;
  private message: string;

  constructor(status: ClientStatus, message: string) {
    this.status = status;
    this.message = message;
  }

  public isReady(): boolean {
    return this.status === ClientStatus.Ready;
  }

  public isIndexing(): boolean {
    return this.status === ClientStatus.Indexing;
  }

  public failedToInitialize(): boolean {
    return this.status === ClientStatus.Error;
  }

  public getStatusMessage(): string {
    return this.message;
  }
}

export interface ProcessDetail {
  pid: number;
  ppid: number;
  command: string;
  orphaned: boolean;
}

export class LanguageClientManager {
  private static instance: LanguageClientManager;
  private clientInstance: ApexLanguageClient | undefined;
  private status: LanguageClientStatus;
  private statusBarItem: ApexLSPStatusBarItem | undefined;
  private isRestarting: boolean = false;
  private restartTimeout: NodeJS.Timeout | undefined;

  private constructor() {
    this.status = new LanguageClientStatus(ClientStatus.Unavailable, '');
  }

  public static getInstance(): LanguageClientManager {
    if (!LanguageClientManager.instance) {
      LanguageClientManager.instance = new LanguageClientManager();
    }
    return LanguageClientManager.instance;
  }

  public getClientInstance(): ApexLanguageClient | undefined {
    return this.clientInstance;
  }

  public setClientInstance(languageClient: ApexLanguageClient | undefined): void {
    this.clientInstance = languageClient;
  }

  public getStatusBarInstance(): ApexLSPStatusBarItem | undefined {
    return this.statusBarItem;
  }

  public setStatusBarInstance(statusBarItem: ApexLSPStatusBarItem | undefined): void {
    this.statusBarItem = statusBarItem;
  }

  public getStatus(): LanguageClientStatus {
    return this.status;
  }

  public setStatus(status: ClientStatus, message: string): void {
    this.status = new LanguageClientStatus(status, message);
  }

  public async getLineBreakpointInfo(): Promise<{}> {
    let response = {};
    const languageClient = this.getClientInstance();
    if (languageClient) {
      response = await languageClient.sendRequest(DEBUGGER_LINE_BREAKPOINTS);
    }
    return Promise.resolve(response);
  }

  public async getApexTests(): Promise<ApexTestMethod[]> {
    let response = new Array<LSPApexTestMethod>();
    const ret = new Array<ApexTestMethod>();
    const languageClient = this.getClientInstance();
    if (languageClient) {
      response = await languageClient.sendRequest('test/getTestMethods');
    }
    for (const requestInfo of response) {
      ret.push(ApexLSPConverter.toApexTestMethod(requestInfo));
    }
    return Promise.resolve(ret);
  }

  public async getExceptionBreakpointInfo(): Promise<{}> {
    let response = {};
    const languageClient = this.getClientInstance();
    if (languageClient) {
      response = await languageClient.sendRequest(DEBUGGER_EXCEPTION_BREAKPOINTS);
    }
    return Promise.resolve(response);
  }

  public async restartLanguageServerAndClient(extensionContext: vscode.ExtensionContext): Promise<void> {
    // If already restarting, show a message and return
    if (this.isRestarting) {
      vscode.window.showInformationMessage(nls.localize('apex_language_server_already_restarting'));
      return;
    }

    const cleanAndRestartOption = nls.localize('apex_language_server_restart_dialog_clean_and_restart');
    const restartOnlyOption = nls.localize('apex_language_server_restart_dialog_restart_only');

    const options = [cleanAndRestartOption, restartOnlyOption];
    const selectedOption = await vscode.window.showQuickPick(options, {
      placeHolder: nls.localize('apex_language_server_restart_dialog_prompt')
    });

    // If no option is selected, cancel the operation
    if (!selectedOption) {
      return;
    }

    // Set the restarting flag to prevent multiple restarts
    this.isRestarting = true;

    const alc = this.getClientInstance();
    const statusBarInstance = this.getStatusBarInstance() ?? new ApexLSPStatusBarItem();
    this.setStatusBarInstance(statusBarInstance);

    if (alc !== undefined) {
      statusBarInstance.restarting();
      try {
        await alc.stop();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showWarningMessage(
          `${nls.localize('apex_language_server_restart_dialog_restart_only')} - ${errorMessage}`
        );
      }
      if (selectedOption === cleanAndRestartOption) {
        await this.removeApexDB();
      }

      // Clear any existing timeout
      if (this.restartTimeout) {
        clearTimeout(this.restartTimeout);
      }

      // Set a new timeout for the restart
      this.restartTimeout = setTimeout(() => {
        void (async () => {
          try {
            // Dispose of the old output channel before restarting the client
            alc.outputChannel?.dispose();
            await this.createLanguageClient(extensionContext, statusBarInstance);
          } catch (error) {
            // Log any errors that occur during client creation
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error creating language client:', errorMessage);
            vscode.window.showErrorMessage(`${nls.localize('apex_language_server_failed_activate')} - ${errorMessage}`);
          } finally {
            // Reset the restarting flag and clear the timeout reference
            this.isRestarting = false;
            this.restartTimeout = undefined;
          }
        })();
      }, 500);
    } else {
      // Reset the restarting flag if there's no client instance
      this.isRestarting = false;
    }
  }

  private async removeApexDB(): Promise<void> {
    if (hasRootWorkspace() && vscode.workspace.workspaceFolders) {
      const wsrf = vscode.workspace.workspaceFolders[0].uri;
      const toolsUri = URI.parse(wsrf.toString()).with({ path: wsrf.path + '/.sfdx/tools' });
      try {
        const entries = await vscode.workspace.fs.readDirectory(toolsUri);
        const releaseFolders = entries
          .filter(([name, type]) => type === vscode.FileType.Directory && /^\d{3}$/.test(name))
          .map(([name]) => name);
        for (const folder of releaseFolders) {
          const folderUri = URI.parse(toolsUri.toString()).with({ path: toolsUri.path + '/' + folder });
          await vscode.workspace.fs.delete(folderUri, { recursive: true, useTrash: true });
        }
      } catch (error) {
        console.log('Error, failed to delete folder:' + error.message);
      }
    }
  }

  public async createLanguageClient(
    extensionContext: vscode.ExtensionContext,
    languageServerStatusBarItem: ApexLSPStatusBarItem
  ): Promise<void> {
    const telemetryService = await getTelemetryService();
    try {
      const langClientHRStart = process.hrtime();
      this.setClientInstance(await languageServer.createLanguageServer(extensionContext));

      const languageClient = this.getClientInstance();

      if (languageClient) {
        languageClient.errorHandler?.addListener('error', (message: string) => {
          languageServerStatusBarItem.error(message);
        });
        languageClient.errorHandler?.addListener('restarting', (count: number) => {
          languageServerStatusBarItem.error(
            nls.localize('apex_language_server_quit_and_restarting').replace('$N', `${count}`)
          );
        });
        languageClient.errorHandler?.addListener('startFailed', () => {
          languageServerStatusBarItem.error(nls.localize('apex_language_server_failed_activate'));
        });

        await languageClient.start();
        const startTime = telemetryService.getEndHRTime(langClientHRStart);
        telemetryService.sendEventData('apexLSPStartup', undefined, {
          activationTime: startTime
        });
        await this.indexerDoneHandler(retrieveEnableSyncInitJobs(), languageClient, languageServerStatusBarItem);
        extensionContext.subscriptions.push(this.getClientInstance()!);
      } else {
        const errorMessage = nls.localize('unknown');
        this.setStatus(ClientStatus.Error, `${nls.localize('apex_language_server_failed_activate')} - ${errorMessage}`);
        languageServerStatusBarItem.error(`${nls.localize('apex_language_server_failed_activate')} - ${errorMessage}`);
      }
    } catch (error) {
      let errorMessage = '';
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error instanceof Error) {
        errorMessage = error.message ?? nls.localize('unknown_error');
      } else {
        errorMessage = nls.localize('unknown_error');
      }
      if (errorMessage.includes(nls.localize('wrong_java_version_text', SET_JAVA_DOC_LINK))) {
        errorMessage = nls.localize('wrong_java_version_short');
      }
      this.setStatus(ClientStatus.Error, errorMessage);
      languageServerStatusBarItem.error(`${nls.localize('apex_language_server_failed_activate')} - ${errorMessage}`);
    }
  }

  public async indexerDoneHandler(
    enableSyncInitJobs: boolean,
    languageClient: ApexLanguageClient,
    languageServerStatusBarItem: ApexLSPStatusBarItem
  ): Promise<void> {
    if (!enableSyncInitJobs) {
      this.setStatus(ClientStatus.Indexing, '');
      languageClient.onNotification(API.doneIndexing, () => {
        void this.setClientReady(languageClient, languageServerStatusBarItem);
      });
    } else {
      await this.setClientReady(languageClient, languageServerStatusBarItem);
    }
  }

  private async setClientReady(
    languageClient: ApexLanguageClient,
    languageServerStatusBarItem: ApexLSPStatusBarItem
  ): Promise<void> {
    await getTestOutlineProvider().refresh();
    languageServerStatusBarItem.ready();
    this.setStatus(ClientStatus.Ready, '');
    languageClient?.errorHandler?.serviceHasStartedSuccessfully();
  }

  public async findAndCheckOrphanedProcesses(): Promise<ProcessDetail[]> {
    const telemetryService = await getTelemetryService();
    const platform = process.platform.toLowerCase();
    const isWindows = platform === 'win32';

    if (!this.canRunCheck(isWindows)) {
      return [];
    }

    const cmd = isWindows
      ? 'powershell.exe -command "Get-CimInstance -ClassName Win32_Process | ForEach-Object { [PSCustomObject]@{ ProcessId = $_.ProcessId; ParentProcessId = $_.ParentProcessId; CommandLine = $_.CommandLine } } | Format-Table -HideTableHeaders"'
      : 'ps -e -o pid,ppid,command';

    const stdout = execSync(cmd).toString();
    const lines = stdout.trim().split(/\r?\n/g);
    const processes: ProcessDetail[] = lines
      .map((line: string) => {
        const [pidStr, ppidStr, ...commandParts] = line.trim().split(/\s+/);
        const pid = parseInt(pidStr, 10);
        const ppid = parseInt(ppidStr, 10);
        const command = commandParts.join(' ');
        return { pid, ppid, command, orphaned: false };
      })
      .filter(
        (processInfo: ProcessDetail) => !['ps', 'grep', 'Get-CimInstance'].some(c => processInfo.command.includes(c))
      )
      .filter((processInfo: ProcessDetail) => processInfo.command.includes('apex-jorje-lsp.jar'));

    if (processes.length === 0) {
      return [];
    }

    const orphanedProcesses: ProcessDetail[] = processes
      .map(processInfo => {
        const checkOrphanedCmd = isWindows
          ? `powershell.exe -command "Get-CimInstance -ClassName Win32_Process -Filter 'ProcessId = ${processInfo.ppid}'"`
          : `ps -p ${processInfo.ppid}`;
        if (!isWindows && processInfo.ppid === 1) {
          processInfo.orphaned = true;
          return processInfo;
        }
        try {
          execSync(checkOrphanedCmd);
        } catch (err) {
          telemetryService.sendException(
            'apex_lsp_orphan',
            typeof err === 'string' ? err : err?.message ? err.message : 'unknown'
          );
          processInfo.orphaned = true;
        }
        return processInfo;
      })
      .filter(processInfo => processInfo.orphaned);
    return orphanedProcesses;
  }

  public terminateProcess(pid: number): void {
    process.kill(pid, 'SIGKILL');
  }

  public canRunCheck(isWindows: boolean): boolean {
    if (isWindows) {
      try {
        const wherePowershell = execSync('where powershell');
        if (wherePowershell.toString().trim().length === 0) {
          return false;
        }
        return true;
      } catch (err) {
        return false;
      }
    }
    return true;
  }
}
