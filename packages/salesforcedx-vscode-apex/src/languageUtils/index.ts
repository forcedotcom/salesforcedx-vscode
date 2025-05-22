/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { ApexLanguageClient } from '../apexLanguageClient';
import ApexLSPStatusBarItem from '../apexLspStatusBarItem';
import { ProcessDetail, languageClientManager } from './languageClientManager';

export { languageClientManager };

export const getLineBreakpointInfo = async (): Promise<{}> => languageClientManager.getLineBreakpointInfo();

export const getApexTests = async () => languageClientManager.getApexTests();

export const getExceptionBreakpointInfo = async (): Promise<{}> => languageClientManager.getExceptionBreakpointInfo();

export const restartLanguageServerAndClient = async (
  extensionContext: vscode.ExtensionContext,
  source: 'commandPalette' | 'statusBar'
): Promise<void> => {
  await languageClientManager.restartLanguageServerAndClient(extensionContext, source);
};

export const createLanguageClient = async (
  extensionContext: vscode.ExtensionContext,
  languageServerStatusBarItem: ApexLSPStatusBarItem
): Promise<void> => languageClientManager.createLanguageClient(extensionContext, languageServerStatusBarItem);

export const indexerDoneHandler = async (
  enableSyncInitJobs: boolean,
  languageClient: ApexLanguageClient,
  languageServerStatusBarItem: ApexLSPStatusBarItem
): Promise<void> =>
  languageClientManager.indexerDoneHandler(enableSyncInitJobs, languageClient, languageServerStatusBarItem);

export const findAndCheckOrphanedProcesses = async (): Promise<ProcessDetail[]> =>
  languageClientManager.findAndCheckOrphanedProcesses();

export const terminateProcess = (pid: number): void => {
  languageClientManager.terminateProcess(pid);
};

export { configureApexLanguage } from './apexLanguageConfiguration';
