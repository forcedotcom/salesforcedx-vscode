/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { ApexLanguageClient } from '../apexLanguageClient';
import ApexLSPStatusBarItem from '../apexLspStatusBarItem';
import { getTelemetryService } from '../telemetry/telemetry';
import { ApexTestMethod } from '../views/lspConverter';
import { ProcessDetail, languageClientManager } from './languageClientManager';

export const getLineBreakpointInfo = async () => languageClientManager.getLineBreakpointInfo();

/** Fetch tests from the Language Server and emit telemetry */
export const fetchFromLs = async (): Promise<{ tests: ApexTestMethod[]; durationMs: number }> => {
  const telemetry = getTelemetryService();
  const start = Date.now();
  telemetry.sendEventData('apexTestDiscoveryStart', { source: 'ls' });
  const tests = await languageClientManager.getApexTests();
  const durationMs = Date.now() - start;
  telemetry.sendEventData('apexTestDiscoveryEnd', { source: 'ls' }, buildMeasuresFromTests(tests, durationMs));
  return { tests, durationMs };
};

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

export const findAndCheckOrphanedProcesses = async (): Promise<ProcessDetail[]> =>
  languageClientManager.findAndCheckOrphanedProcesses();

export const terminateProcess = (pid: number): void => {
  languageClientManager.terminateProcess(pid);
};

export { configureApexLanguage } from './apexLanguageConfiguration';
export { languageClientManager } from './languageClientManager';
