/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LanguageClient } from 'vscode-languageclient';
import {
  DEBUGGER_EXCEPTION_BREAKPOINTS,
  DEBUGGER_LINE_BREAKPOINTS
} from './constants';
import {
  ApexLSPConverter,
  ApexTestMethod,
  LSPApexTestMethod
} from './views/lspConverter';

export class LanguageClientUtils {
  private static instance: LanguageClient | undefined;
  public static languageClientReady = false;
  public static getClientInstance(): LanguageClient | undefined {
    return LanguageClientUtils.instance;
  }

  public static setClientInstance(languageClient: LanguageClient | undefined) {
    LanguageClientUtils.instance = languageClient;
  }
}
export async function getLineBreakpointInfo(): Promise<{}> {
  let response = {};
  const languageClient = LanguageClientUtils.getClientInstance();
  if (languageClient) {
    response = await languageClient.sendRequest(DEBUGGER_LINE_BREAKPOINTS);
  }
  return Promise.resolve(response);
}

export async function getApexTests(): Promise<ApexTestMethod[]> {
  let response = new Array<LSPApexTestMethod>();
  const ret = new Array<ApexTestMethod>();
  const languageClient = LanguageClientUtils.getClientInstance();
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
  const languageClient = LanguageClientUtils.getClientInstance();
  if (languageClient) {
    response = await languageClient.sendRequest(DEBUGGER_EXCEPTION_BREAKPOINTS);
  }
  return Promise.resolve(response);
}

export function isLanguageClientReady(): boolean {
  return LanguageClientUtils.languageClientReady;
}
