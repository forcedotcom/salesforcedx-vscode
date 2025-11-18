/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import * as vscode from 'vscode';
import { ApexLanguageClient } from '../apexLanguageClient';
import ApexLSPStatusBarItem from '../apexLspStatusBarItem';
import { getTelemetryService } from '../telemetry/telemetry';
import { discoverTests } from '../testDiscovery/testDiscovery';
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

/** Fetch tests from the Tooling API Test Discovery endpoint */
export const fetchFromApi = async (): Promise<{ tests: ApexTestMethod[]; durationMs: number }> => {
  const start = Date.now();
  // API path already emits its own Start/End events with source=api internally
  const result = await discoverTests();
  const tests = await convertApiToApexTestMethods(result.classes ?? []);
  const durationMs = Date.now() - start;
  return { tests, durationMs };
};

/**
 * Returns Apex tests using the configured discovery source.
 * - ls: queries the Language Server
 * - api: queries the Tooling API Test Discovery endpoint
 * Also emits timing metrics and telemetry.
 */
export const getApexTests = async (): Promise<ApexTestMethod[]> => {
  const config = vscode.workspace.getConfiguration('salesforcedx-vscode-apex');
  const source = config.get<'ls' | 'api'>('testing.discoverySource', 'ls');

  // Fetch according to user selection
  const selected = source === 'ls' ? await fetchFromLs() : await fetchFromApi();
  return selected.tests;
};

const buildMeasuresFromTests = (tests: ApexTestMethod[], durationMs: number) => {
  const numClasses = new Set(tests.map(t => t.definingType)).size;
  const numMethods = tests.length;
  return { durationMs, numClasses, numMethods };
};

/**
 * Convert API test discovery results to ApexTestMethod format with file locations.
 * Note: The Tooling API does not provide line/column info, so all locations point to the start of the file (0,0).
 * For precise method locations, the Language Server discovery should be used instead.
 */
const convertApiToApexTestMethods = async (
  classes: { name: string; namespacePrefix?: string | null; testMethods?: { name: string }[] }[]
): Promise<ApexTestMethod[]> => {
  const classNameToUri = await buildClassToUriIndex();

  const tests: ApexTestMethod[] = [];
  for (const c of classes) {
    let uri = classNameToUri.get(c.name);
    // If not found in the prebuilt index, try a targeted search in case the index missed it
    if (!uri) {
      try {
        // Look for the class file anywhere in the workspace (exclude .sfdx)
        const matches = await vscode.workspace.findFiles(`**/${c.name}.cls`, '**/.sfdx/**', 1);
        uri = matches[0];
      } catch {
        // ignore search failures
      }
    }
    // Skip classes we can't find in the workspace
    if (!uri) {
      continue;
    }
    const definingType = c.namespacePrefix ? `${c.namespacePrefix}.${c.name}` : c.name;
    const location = new vscode.Location(uri, new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)));
    for (const m of c.testMethods ?? []) {
      tests.push({
        methodName: m.name,
        definingType,
        location
      });
    }
  }
  return tests;
};

/** Build an index of test class names to their file URIs by searching for files matching *Test*.cls */
const buildClassToUriIndex = async (): Promise<Map<string, vscode.Uri>> => {
  const map = new Map<string, vscode.Uri>();
  try {
    // Exclude .sfdx folder to avoid cached/generated files
    const apexFiles = await vscode.workspace.findFiles('**/*[Tt]est*.cls', '**/.sfdx/**');
    for (const file of apexFiles) {
      const base = path.parse(file.fsPath).name;
      if (!map.has(base)) {
        map.set(base, file);
      }
    }
  } catch {
    // ignore
  }
  return map;
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
