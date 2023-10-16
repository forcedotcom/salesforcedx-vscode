/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LanguageClient } from 'vscode-languageclient/node';
import {
  DEBUGGER_EXCEPTION_BREAKPOINTS,
  DEBUGGER_LINE_BREAKPOINTS
} from '../constants';
import {
  ApexLSPConverter,
  ApexTestMethod,
  LSPApexTestMethod
} from '../views/lspConverter';

export class LanguageClientUtils {
  private static instance: LanguageClientUtils;
  private clientInstance: LanguageClient | undefined;
  private status: LanguageClientStatus;

  constructor() {
    this.status = new LanguageClientStatus(ClientStatus.Unavailable, '');
  }

  public static getInstance() {
    if (!LanguageClientUtils.instance) {
      LanguageClientUtils.instance = new LanguageClientUtils();
    }
    return LanguageClientUtils.instance;
  }

  public getClientInstance(): LanguageClient | undefined {
    return this.clientInstance;
  }

  public setClientInstance(languageClient: LanguageClient | undefined) {
    this.clientInstance = languageClient;
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

export async function getLineBreakpointInfo(): Promise<{}> {
  let response = {};
  const languageClient = LanguageClientUtils.getInstance().getClientInstance();
  if (languageClient) {
    response = await languageClient.sendRequest(DEBUGGER_LINE_BREAKPOINTS);
  }
  return Promise.resolve(response);
}

export async function getApexTests(): Promise<ApexTestMethod[]> {
  let response = new Array<LSPApexTestMethod>();
  const ret = new Array<ApexTestMethod>();
  const languageClient = LanguageClientUtils.getInstance().getClientInstance();
  if (languageClient) {
    response = (await languageClient.sendRequest(
      'test/getTestMethods'
    )) as LSPApexTestMethod[];
  }
  for (const requestInfo of response) {
    ret.push(ApexLSPConverter.toApexTestMethod(requestInfo));
  }
  return Promise.resolve(ret);
}

export async function getExceptionBreakpointInfo(): Promise<{}> {
  let response = {};
  const languageClient = LanguageClientUtils.getInstance().getClientInstance();
  if (languageClient) {
    response = await languageClient.sendRequest(DEBUGGER_EXCEPTION_BREAKPOINTS);
  }
  return Promise.resolve(response);
}
