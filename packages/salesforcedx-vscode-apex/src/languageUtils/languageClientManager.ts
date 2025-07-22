/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LineBreakpointInfo } from '@salesforce/salesforcedx-utils';
import { hasRootWorkspace, TimingUtils } from '@salesforce/salesforcedx-utils-vscode';
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

class LanguageClientStatus {
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

interface RestartQuickPickItem extends vscode.QuickPickItem {
  type: 'restart' | 'reset';
}

export class LanguageClientManager {
  private static instance: LanguageClientManager;
  private clientInstance: ApexLanguageClient | undefined;
  private status: LanguageClientStatus;
  private statusBarItem: ApexLSPStatusBarItem | undefined;
  private isRestarting: boolean = false;
  private restartTimeout: NodeJS.Timeout | undefined;

  private readonly RESTART_OPTIONS = {
    cleanAndRestart: nls.localize('apex_language_server_restart_dialog_clean_and_restart'),
    restartOnly: nls.localize('apex_language_server_restart_dialog_restart_only')
  };

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

  public async getLineBreakpointInfo(): Promise<LineBreakpointInfo[]> {
    return this.clientInstance ? this.clientInstance.sendRequest<LineBreakpointInfo[]>(DEBUGGER_LINE_BREAKPOINTS) : [];
  }

  public async getApexTests(): Promise<ApexTestMethod[]> {
    return this.clientInstance
      ? (await this.clientInstance.sendRequest<LSPApexTestMethod[]>('test/getTestMethods')).map(requestInfo =>
          ApexLSPConverter.toApexTestMethod(requestInfo)
        )
      : [];
  }

  public async getExceptionBreakpointInfo(): Promise<{}> {
    return this.clientInstance ? this.clientInstance.sendRequest(DEBUGGER_EXCEPTION_BREAKPOINTS) : {};
  }

  private async showRestartQuickPick(
    items: RestartQuickPickItem[],
    source: 'commandPalette' | 'statusBar',
    restartBehavior: string
  ): Promise<string | undefined> {
    const selectedOption = await vscode.window.showQuickPick(items, {
      placeHolder: nls.localize('apex_language_server_restart_dialog_prompt')
    });

    if (selectedOption) {
      await this.sendRestartTelemetry(selectedOption, source, restartBehavior);
      return selectedOption.label;
    }
    return undefined;
  }

  private async sendRestartTelemetry(
    selectedOption: RestartQuickPickItem,
    source: 'commandPalette' | 'statusBar',
    restartBehavior: string
  ): Promise<void> {
    const telemetryService = getTelemetryService();
    telemetryService.sendEventData('apexLSPRestart', {
      restartBehavior: restartBehavior === 'prompt' ? 'prompt' : restartBehavior,
      selectedOption: selectedOption.type,
      source,
      defaultOption: restartBehavior
    });
  }

  private async getRestartOption(source: 'commandPalette' | 'statusBar'): Promise<string | undefined> {
    const config = vscode.workspace.getConfiguration('salesforcedx-vscode-apex');
    const restartBehavior = config.get<string>('languageServer.restartBehavior', 'prompt');

    // If launched from command palette, always show prompt with default option first
    if (source === 'commandPalette') {
      // Order items based on the setting
      const items: RestartQuickPickItem[] =
        restartBehavior === 'reset'
          ? [
              { label: this.RESTART_OPTIONS.cleanAndRestart, description: '', type: 'reset' },
              { label: this.RESTART_OPTIONS.restartOnly, description: '', type: 'restart' }
            ]
          : [
              { label: this.RESTART_OPTIONS.restartOnly, description: '', type: 'restart' },
              { label: this.RESTART_OPTIONS.cleanAndRestart, description: '', type: 'reset' }
            ];

      return this.showRestartQuickPick(items, source, restartBehavior);
    }

    // For status bar, use the setting value directly if not 'prompt'
    if (source === 'statusBar') {
      switch (restartBehavior) {
        case 'restart':
          await this.sendRestartTelemetry(
            { label: this.RESTART_OPTIONS.restartOnly, description: '', type: 'restart' },
            source,
            restartBehavior
          );
          return this.RESTART_OPTIONS.restartOnly;
        case 'reset':
          await this.sendRestartTelemetry(
            { label: this.RESTART_OPTIONS.cleanAndRestart, description: '', type: 'reset' },
            source,
            restartBehavior
          );
          return this.RESTART_OPTIONS.cleanAndRestart;
        case 'prompt':
        default:
          const promptItems: RestartQuickPickItem[] = [
            { label: this.RESTART_OPTIONS.restartOnly, description: '', type: 'restart' },
            { label: this.RESTART_OPTIONS.cleanAndRestart, description: '', type: 'reset' }
          ];
          return this.showRestartQuickPick(promptItems, source, restartBehavior);
      }
    }

    // This case should never be reached as source is now required
    throw new Error('Invalid source parameter');
  }

  public async restartLanguageServerAndClient(
    extensionContext: vscode.ExtensionContext,
    source: 'commandPalette' | 'statusBar'
  ): Promise<void> {
    // If already restarting, show a message and return
    if (this.isRestarting) {
      vscode.window.showInformationMessage(nls.localize('apex_language_server_already_restarting'));
      return;
    }

    const selectedOption = await this.getRestartOption(source);

    // If no option is selected (in prompt mode), cancel the operation
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
      if (selectedOption === nls.localize('apex_language_server_restart_dialog_clean_and_restart')) {
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
      const toolsUri = URI.parse(wsrf.toString()).with({ path: `${wsrf.path}/.sfdx/tools` });
      try {
        await Promise.all(
          (await vscode.workspace.fs.readDirectory(toolsUri))
            .filter(([name, type]) => type === vscode.FileType.Directory && /^\d{3}$/.test(name))
            .map(([name]) => name)
            .map(folder => URI.parse(toolsUri.toString()).with({ path: `${toolsUri.path}/${folder}` }))
            .map(folderUri => vscode.workspace.fs.delete(folderUri, { recursive: true, useTrash: true }))
        );
      } catch (error) {
        console.log(`Error, failed to delete folder:${error.message}`);
      }
    }
  }

  public async createLanguageClient(
    extensionContext: vscode.ExtensionContext,
    languageServerStatusBarItem: ApexLSPStatusBarItem
  ): Promise<void> {
    const telemetryService = getTelemetryService();
    try {
      const langClientStartTime = TimingUtils.getCurrentTime();
      this.setClientInstance(await languageServer.createLanguageServer(extensionContext));

      const languageClient = this.getClientInstance();

      if (languageClient) {
        languageClient.errorHandler?.addListener('error', (message: string) => {
          languageServerStatusBarItem.error(message);
        });
        languageClient.errorHandler?.addListener('restarting', (count: number) => {
          languageServerStatusBarItem.error(nls.localize('apex_language_server_quit_and_restarting', count));
        });
        languageClient.errorHandler?.addListener('startFailed', () => {
          languageServerStatusBarItem.error(nls.localize('apex_language_server_failed_activate'));
        });

        await languageClient.start();
        const startTime = TimingUtils.getElapsedTime(langClientStartTime);
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
    const telemetryService = getTelemetryService();
    const isWindows = process.platform === 'win32';

    if (!this.canRunCheck(isWindows)) {
      return [];
    }

    const cmd = isWindows
      ? 'powershell.exe -command "Get-CimInstance -ClassName Win32_Process | ForEach-Object { [PSCustomObject]@{ ProcessId = $_.ProcessId; ParentProcessId = $_.ParentProcessId; CommandLine = $_.CommandLine } } | Format-Table -HideTableHeaders"'
      : 'ps -e -o pid,ppid,command';

    const stdout = execSync(cmd).toString();
    return stdout
      .trim()
      .split(/\r?\n/g)
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
      .filter((processInfo: ProcessDetail) => processInfo.command.includes('apex-jorje-lsp.jar'))
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
            typeof err === 'string' ? err : (err?.message ?? 'unknown')
          );
          processInfo.orphaned = true;
        }
        return processInfo;
      })
      .filter(processInfo => processInfo.orphaned);
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
      } catch {
        return false;
      }
    }
    return true;
  }
}

/** instantiate and export the singleton instance */
export const languageClientManager = LanguageClientManager.getInstance();
