/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type ApexLSPStatusBarItem from '../apexLspStatusBarItem';
import type {
  ApexClassOASEligibleResponses,
  ApexClassOASGatherContextResponse,
  ApexOASEligiblePayload
} from '../oasSchemas';
import * as Effect from 'effect/Effect';
import type * as vscode from 'vscode';
import { type URI } from 'vscode-uri';
import { languageClientManager } from './languageClientManager';

export const getLineBreakpointInfo = async () => languageClientManager.getLineBreakpointInfo();

export const getExceptionBreakpointInfo = async () => languageClientManager.getExceptionBreakpointInfo();

export const isOpenAPIEligible = async (
  requests: ApexOASEligiblePayload
): Promise<ApexClassOASEligibleResponses | undefined> => languageClientManager.isOpenAPIEligible(requests);

export const gatherOpenAPIContext = async (sourceUri: URI): Promise<ApexClassOASGatherContextResponse | undefined> =>
  languageClientManager.gatherOpenAPIContext(sourceUri);

export const restartLanguageServerAndClient = async (
  extensionContext: vscode.ExtensionContext,
  source: 'commandPalette' | 'statusBar'
): Promise<void> => {
  await languageClientManager.restartLanguageServerAndClient(extensionContext, source);
};

export const createLanguageClient = Effect.fn('languageUtils.createLanguageClient')(function* (
  extensionContext: vscode.ExtensionContext,
  languageServerStatusBarItem: ApexLSPStatusBarItem
) {
  yield* languageClientManager.activateLanguageClient(extensionContext, languageServerStatusBarItem);
});

export { configureApexLanguage } from './apexLanguageConfiguration';
export { languageClientManager } from './languageClientManager';
