/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { ApexLanguageClient } from '../apexLanguageClient';
import ApexLSPStatusBarItem from '../apexLspStatusBarItem';
import { LanguageClientManager, ClientStatus, LanguageClientStatus, ProcessDetail } from './languageClientManager';

export const languageClientManager = LanguageClientManager.getInstance();

export { ClientStatus, LanguageClientStatus, ProcessDetail };

export const getLineBreakpointInfo = async (): Promise<{}> =>
  LanguageClientManager.getInstance().getLineBreakpointInfo();

export const getApexTests = async (): Promise<any[]> => LanguageClientManager.getInstance().getApexTests();

export const getExceptionBreakpointInfo = async (): Promise<{}> =>
  LanguageClientManager.getInstance().getExceptionBreakpointInfo();

export const restartLanguageServerAndClient = async (extensionContext: vscode.ExtensionContext): Promise<void> =>
  LanguageClientManager.getInstance().restartLanguageServerAndClient(extensionContext);

export const createLanguageClient = async (
  extensionContext: vscode.ExtensionContext,
  languageServerStatusBarItem: ApexLSPStatusBarItem
): Promise<void> =>
  LanguageClientManager.getInstance().createLanguageClient(extensionContext, languageServerStatusBarItem);

export const indexerDoneHandler = async (
  enableSyncInitJobs: boolean,
  languageClient: ApexLanguageClient,
  languageServerStatusBarItem: ApexLSPStatusBarItem
): Promise<void> =>
  LanguageClientManager.getInstance().indexerDoneHandler(
    enableSyncInitJobs,
    languageClient,
    languageServerStatusBarItem
  );

export const findAndCheckOrphanedProcesses = async (): Promise<ProcessDetail[]> =>
  LanguageClientManager.getInstance().findAndCheckOrphanedProcesses();

export const terminateProcess = (pid: number): void => {
  LanguageClientManager.getInstance().terminateProcess(pid);
};

export const canRunCheck = async (isWindows: boolean): Promise<boolean> =>
  LanguageClientManager.getInstance().canRunCheck(isWindows);

export { configureApexLanguage } from './apexLanguageConfiguration';

export { extensionUtils } from './extensionUtils';
