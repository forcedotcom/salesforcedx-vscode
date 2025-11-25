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
export const fetchFromApi = async (options?: {
  namespacePrefix?: string;
}): Promise<{ tests: ApexTestMethod[]; durationMs: number }> => {
  const start = Date.now();
  // API path already emits its own Start/End events with source=api internally
  const result = await discoverTests({
    showAllMethods: true,
    namespacePrefix: options?.namespacePrefix
  });
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
  const apiByClassName = new Map<string, { namespacePrefix?: string | null; testMethods?: { name: string }[] }[]>();
  for (const cls of classes) {
    if (!cls.testMethods || cls.testMethods.length === 0) continue;
    // Only consider tests in the local (default) namespace; workspace index maps local files only
    if (cls.namespacePrefix && cls.namespacePrefix.trim() !== '') continue;
    const list = apiByClassName.get(cls.name) ?? [];
    list.push(cls);
    apiByClassName.set(cls.name, list);
  }

  const tests: ApexTestMethod[] = [];
  for (const [className, uri] of classNameToUri) {
    const apiEntries = apiByClassName.get(className);
    if (!apiEntries) continue;

    const emitted = new Set<string>();
    const location = new vscode.Location(uri, new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)));
    for (const entry of apiEntries) {
      const definingType = entry.namespacePrefix ? `${entry.namespacePrefix}.${className}` : className;
      for (const testMethod of entry.testMethods ?? []) {
        if (emitted.has(testMethod.name)) continue;
        tests.push({
          methodName: testMethod.name,
          definingType,
          location
        });
        emitted.add(testMethod.name);
      }
    }
  }
  return tests;
};

/** Build an index of class baseName -> file URI with a single pass per workspace folder */
const buildClassToUriIndex = async (): Promise<Map<string, vscode.Uri>> => {
  const map = new Map<string, vscode.Uri>();
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return map;
  }
  try {
    // Only look under classes folders for Apex test files
    const pattern = new vscode.RelativePattern(folder, '**/classes/**/*[Tt]est*.cls');
    const exclude = '{**/.sfdx/**,**/.sf/**,**/node_modules/**}';
    const files = await vscode.workspace.findFiles(pattern, exclude);
    files.sort((a, b) => a.fsPath.length - b.fsPath.length);
    for (const file of files) {
      const base = path.parse(file.fsPath).name;
      map.set(base, file);
    }
  } catch {
    console.error('Error building class to URI index');
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
