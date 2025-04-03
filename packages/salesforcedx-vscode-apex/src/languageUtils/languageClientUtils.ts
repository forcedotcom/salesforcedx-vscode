/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { ApexLanguageClient } from '../apexLanguageClient';
import ApexLSPStatusBarItem from '../apexLspStatusBarItem';
import { LanguageClientManager, ClientStatus, LanguageClientStatus } from './languageClientManager';

export class LanguageClientUtils {
  private static instance: LanguageClientUtils;
  private manager: LanguageClientManager;

  private constructor() {
    this.manager = LanguageClientManager.getInstance();
  }

  public static getInstance(): LanguageClientUtils {
    if (!LanguageClientUtils.instance) {
      LanguageClientUtils.instance = new LanguageClientUtils();
    }
    return LanguageClientUtils.instance;
  }

  public getClientInstance(): ApexLanguageClient | undefined {
    return this.manager.getClientInstance();
  }

  public setClientInstance(languageClient: ApexLanguageClient | undefined): void {
    this.manager.setClientInstance(languageClient);
  }

  public getStatusBarInstance(): ApexLSPStatusBarItem | undefined {
    return this.manager.getStatusBarInstance();
  }

  public setStatusBarInstance(statusBarItem: ApexLSPStatusBarItem | undefined): void {
    this.manager.setStatusBarInstance(statusBarItem);
  }

  public getStatus(): LanguageClientStatus {
    return this.manager.getStatus();
  }

  public setStatus(status: ClientStatus, message: string): void {
    this.manager.setStatus(status, message);
  }
}

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
