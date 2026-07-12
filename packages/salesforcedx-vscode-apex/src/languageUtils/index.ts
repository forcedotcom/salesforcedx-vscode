/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Clock from 'effect/Clock';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { ApexLanguageClient } from '../apexLanguageClient';
import ApexLSPStatusBarItem from '../apexLspStatusBarItem';
import { getRuntime } from '../services/runtime';
import { ApexTestMethod } from '../views/lspConverter';
import { languageClientManager } from './languageClientManager';

export const getLineBreakpointInfo = async () => languageClientManager.getLineBreakpointInfo();

/** Named failure for LS test-discovery so callers can discriminate instead of an opaque unknown. */
class ApexTestDiscoveryError extends Data.TaggedError('ApexTestDiscoveryError')<{
  readonly cause: unknown;
  readonly message: string;
}> {}

/** Fetch tests from the Language Server, emitting a top-level span with timing/count attrs. */
const discoverFromLs = Effect.fn('apex.test.discovery', { root: true })(function* () {
  const start = yield* Clock.currentTimeMillis;
  const tests = yield* Effect.tryPromise({
    try: () => languageClientManager.getApexTests(),
    catch: cause =>
      new ApexTestDiscoveryError({ cause, message: cause instanceof Error ? cause.message : String(cause) })
  });
  const durationMs = (yield* Clock.currentTimeMillis) - start;
  yield* Effect.annotateCurrentSpan({ source: 'ls', ...buildMeasuresFromTests(tests, durationMs) });
  return { tests, durationMs };
});

export const fetchFromLs = async (): Promise<{ tests: ApexTestMethod[]; durationMs: number }> =>
  getRuntime().runPromise(discoverFromLs());

/**
 * Returns Apex tests from the Language Server.
 * For API-based test discovery, use the testing extension.
 * Also emits timing metrics and telemetry.
 */
export const getApexTests = async (): Promise<ApexTestMethod[]> => {
  const result = await fetchFromLs();
  return result.tests;
};

const buildMeasuresFromTests = (tests: ApexTestMethod[], durationMs: number) => {
  const numClasses = new Set(tests.map(t => t.definingType)).size;
  const numMethods = tests.length;
  return { durationMs, numClasses, numMethods };
};

export const getExceptionBreakpointInfo = async () => languageClientManager.getExceptionBreakpointInfo();

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

export { configureApexLanguage } from './apexLanguageConfiguration';
export { languageClientManager } from './languageClientManager';
