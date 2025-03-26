/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { ApexLanguageClient } from '../apexLanguageClient';
import ApexLSPStatusBarItem from '../apexLspStatusBarItem';
import { API, DEBUGGER_EXCEPTION_BREAKPOINTS, DEBUGGER_LINE_BREAKPOINTS, SET_JAVA_DOC_LINK } from '../constants';
import * as languageServer from '../languageServer';
import { nls } from '../messages';
import { retrieveEnableSyncInitJobs } from '../settings';
import { getTelemetryService } from '../telemetry/telemetry';
import { ApexLSPConverter, ApexTestMethod, LSPApexTestMethod } from '../views/lspConverter';
import { languageClientUtils } from '.';
import { extensionUtils } from './extensionUtils';
export class LanguageClientUtils {
  private static instance: LanguageClientUtils;
  private clientInstance: ApexLanguageClient | undefined;
  private status: LanguageClientStatus;
  private statusBarItem: ApexLSPStatusBarItem | undefined;
  constructor() {
    this.status = new LanguageClientStatus(ClientStatus.Unavailable, '');
  }

  public static getInstance(): LanguageClientUtils {
    if (!LanguageClientUtils.instance) {
      LanguageClientUtils.instance = new LanguageClientUtils();
    }
    return LanguageClientUtils.instance;
  }

  public getClientInstance(): ApexLanguageClient | undefined {
    return this.clientInstance;
  }

  public setClientInstance(languageClient: ApexLanguageClient | undefined) {
    this.clientInstance = languageClient;
  }

  public getStatusBarInstance(): ApexLSPStatusBarItem | undefined {
    return this.statusBarItem;
  }

  public setStatusBarInstance(statusBarItem: ApexLSPStatusBarItem | undefined) {
    this.statusBarItem = statusBarItem;
  }

  public getStatus() {
    return this.status;
  }

  public setStatus(status: ClientStatus, message: string) {
    this.status = new LanguageClientStatus(status, message);
  }
}

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

export const getLineBreakpointInfo = async (): Promise<{}> => {
  let response = {};
  const languageClient = LanguageClientUtils.getInstance().getClientInstance();
  if (languageClient) {
    response = await languageClient.sendRequest(DEBUGGER_LINE_BREAKPOINTS);
  }
  return Promise.resolve(response);
};

export const getApexTests = async (): Promise<ApexTestMethod[]> => {
  let response = new Array<LSPApexTestMethod>();
  const ret = new Array<ApexTestMethod>();
  const languageClient = LanguageClientUtils.getInstance().getClientInstance();
  if (languageClient) {
    response = await languageClient.sendRequest('test/getTestMethods');
  }
  for (const requestInfo of response) {
    ret.push(ApexLSPConverter.toApexTestMethod(requestInfo));
  }
  return Promise.resolve(ret);
};

export const getExceptionBreakpointInfo = async (): Promise<{}> => {
  let response = {};
  const languageClient = LanguageClientUtils.getInstance().getClientInstance();
  if (languageClient) {
    response = await languageClient.sendRequest(DEBUGGER_EXCEPTION_BREAKPOINTS);
  }
  return Promise.resolve(response);
};

export const restartLanguageServerAndClient = async (extensionContext: vscode.ExtensionContext) => {
  const removeIndexFiles = await vscode.window.showInformationMessage(
    nls.localize('apex_language_server_restart_dialog_prompt'),
    nls.localize('apex_language_server_restart_dialog_clean_and_restart'),
    nls.localize('apex_language_server_restart_dialog_restart_only')
  );
  //get the client and status bar item
  const alc = LanguageClientUtils.getInstance().getClientInstance();
  const statusBarInstance = LanguageClientUtils.getInstance().getStatusBarInstance() ?? new ApexLSPStatusBarItem();
  LanguageClientUtils.getInstance().setStatusBarInstance(statusBarInstance);

  if (alc !== undefined) {
    statusBarInstance.restarting(); // update the status to user that we're restarting
    // Stop the client and server with the safe stop() routine from the client.
    // Server is stopped automatically as part of that procedure
    try {
      //if we try and restart during another restart or with a startFailed status, we'll throw an exception
      await alc.stop();
    } catch (error) {
      //if the client is in the state of startFailed, we need to kill the LSP jar and then move on.
      //todo: do we want to kill LSP jar manually here?
      vscode.window.showWarningMessage(
        nls.localize('apex_language_server_restart_dialog_restart_only') + error.message
      );
    }
    if (removeIndexFiles === nls.localize('apex_language_server_restart_dialog_clean_and_restart')) {
      //delete the apex DB file if we need a clean slate
      await removeApexDB();
    }
    //Need a half second timeout for the creation of a new language client so that we give the previous LS a moment to complete shutdown
    setTimeout(createLanguageClient, 500, extensionContext, statusBarInstance);
  }
};

const removeApexDB = async () => {
  if (vscode.workspace.workspaceFolders) {
    const wsrf = vscode.workspace.workspaceFolders[0].uri;
    const toolsUri = vscode.Uri.joinPath(wsrf, '.sfdx', 'tools');
    try {
      const entries = await vscode.workspace.fs.readDirectory(toolsUri);
      const releaseFolders = entries
        .filter(([name, type]) => type === vscode.FileType.Directory && /^\d{3}$/.test(name))
        .map(([name]) => name);
      for (const folder of releaseFolders) {
        const folderUri = vscode.Uri.joinPath(toolsUri, folder);
        await vscode.workspace.fs.delete(folderUri, { recursive: true, useTrash: true });
      }
    } catch (error) {
      console.log('Error, failed to delete folder:' + error.message);
    }
  }
};

export const createLanguageClient = async (
  extensionContext: vscode.ExtensionContext,
  languageServerStatusBarItem: ApexLSPStatusBarItem
): Promise<void> => {
  const telemetryService = await getTelemetryService();
  // Initialize Apex language server
  try {
    const langClientHRStart = process.hrtime();
    languageClientUtils.setClientInstance(await languageServer.createLanguageServer(extensionContext));

    const languageClient = languageClientUtils.getClientInstance();

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

      // TODO: the client should not be undefined. We should refactor the code to
      // so there is no question as to whether the client is defined or not.
      await languageClient.start();
      // Client is running
      const startTime = telemetryService.getEndHRTime(langClientHRStart); // Record the end time
      telemetryService.sendEventData('apexLSPStartup', undefined, {
        activationTime: startTime
      });
      await indexerDoneHandler(retrieveEnableSyncInitJobs(), languageClient, languageServerStatusBarItem);
      extensionContext.subscriptions.push(languageClientUtils.getClientInstance()!);
    } else {
      languageClientUtils.setStatus(
        ClientStatus.Error,
        `${nls.localize('apex_language_server_failed_activate')} - ${nls.localize('unknown')}`
      );
      languageServerStatusBarItem.error(
        `${nls.localize('apex_language_server_failed_activate')} - ${nls.localize('unknown')}`
      );
    }
  } catch (e) {
    let errorMessage = '';
    if (typeof e === 'string') {
      errorMessage = e;
    } else if (e instanceof Error) {
      errorMessage = e.message ?? nls.localize('unknown_error');
    }
    if (errorMessage.includes(nls.localize('wrong_java_version_text', SET_JAVA_DOC_LINK))) {
      errorMessage = nls.localize('wrong_java_version_short');
    }
    languageClientUtils.setStatus(ClientStatus.Error, errorMessage);
    languageServerStatusBarItem.error(`${nls.localize('apex_language_server_failed_activate')} - ${errorMessage}`);
  }
};

// exported only for test
export const indexerDoneHandler = async (
  enableSyncInitJobs: boolean,
  languageClient: ApexLanguageClient,
  languageServerStatusBarItem: ApexLSPStatusBarItem
) => {
  // Listener is useful only in async mode
  if (!enableSyncInitJobs) {
    // The listener should be set after languageClient is ready
    // Language client will get notified once async init jobs are done
    languageClientUtils.setStatus(ClientStatus.Indexing, '');
    languageClient.onNotification(API.doneIndexing, () => {
      void extensionUtils.setClientReady(languageClient, languageServerStatusBarItem);
    });
  } else {
    // indexer must be running at the point
    await extensionUtils.setClientReady(languageClient, languageServerStatusBarItem);
  }
};
