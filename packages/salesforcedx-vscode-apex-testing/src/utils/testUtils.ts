/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ToolingTestClass } from '../testDiscovery/schemas';
import { ResultFormat, TestResult, TestService } from '@salesforce/apex-node';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { getServicesApi } from '../services/extensionProvider';
import { discoverTests } from '../testDiscovery/testDiscovery';
import { getUriPath } from '../utils/commandletHelpers';
import { ApexTestMethod } from '../views/lspConverter';

/**
 * Builds a full class name from a ToolingTestClass, including namespace prefix if present
 */
export const getFullClassName = (cls: ToolingTestClass): string =>
  cls.namespacePrefix ? `${cls.namespacePrefix}.${cls.name}` : cls.name;

/**
 * Checks if a ToolingTestClass is a Flow test (Flow tests have namespacePrefix starting with 'FlowTesting')
 */
export const isFlowTest = (cls: ToolingTestClass): boolean => cls.namespacePrefix?.startsWith('FlowTesting') ?? false;

/**
 * Checks if a ToolingTestClass has a non-empty namespace prefix
 */
const hasNamespace = (cls: ToolingTestClass): boolean => (cls.namespacePrefix?.trim() ?? '') !== '';

/**
 * Fetch tests from the Tooling API Test Discovery endpoint
 */
const fetchFromApi = async (options?: {
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
 * Returns Apex tests using the Tooling API Test Discovery endpoint.
 * Also emits timing metrics and telemetry.
 */
export const getApexTests = async (): Promise<ApexTestMethod[]> => {
  // Always use API discovery
  const selected = await fetchFromApi();
  return selected.tests;
};

/**
 * Recursively search for a method in document symbols.
 * Returns the location of the method if found, undefined otherwise.
 */
/**
 * Extract the method name from a symbol name that may include return type and parentheses.
 * Examples:
 * - "methodName() : void" -> "methodName"
 * - "methodName(Integer) : void" -> "methodName"
 * - "methodName" -> "methodName"
 */
const extractMethodName = (symbolName: string): string => {
  // Remove return type (everything after " : ")
  const withoutReturnType = symbolName.split(' : ')[0];
  // Remove parentheses and parameters (everything after "(")
  const methodName = withoutReturnType.split('(')[0];
  return methodName.trim();
};

export const findMethodInSymbols = (
  symbols: vscode.DocumentSymbol[],
  methodName: string,
  uri: vscode.Uri
): vscode.Location | undefined => {
  for (const symbol of symbols) {
    if (symbol.kind === vscode.SymbolKind.Method) {
      // Extract the base method name from the symbol (remove return type and parameters)
      const symbolMethodName = extractMethodName(symbol.name);
      if (symbolMethodName === methodName) {
        return new vscode.Location(uri, symbol.range);
      }
    }
    // Recursively search in children (nested classes)
    if (symbol.children?.length > 0) {
      const found = findMethodInSymbols(symbol.children, methodName, uri);
      if (found) return found;
    }
  }
  return undefined;
};

/**
 * Get method locations from document symbols for a given URI and method names.
 * Returns a map of method names to their locations, or undefined if symbols are not available.
 */
export const getMethodLocationsFromSymbols = async (
  uri: vscode.Uri,
  methodNames: string[]
): Promise<Map<string, vscode.Location> | undefined> => {
  let documentSymbols: vscode.DocumentSymbol[] | undefined;
  try {
    // Ensure the document is accessible - try to open it if needed
    let document = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
    if (!document) {
      // Document might not be open, try to open it
      try {
        document = await vscode.workspace.openTextDocument(uri);
      } catch {
        // If we can't open the document, document symbols won't be available
        return undefined;
      }
    }

    const symbolResult = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      uri
    );
    documentSymbols = symbolResult;
  } catch {
    // If document symbols are not available, return undefined
    return undefined;
  }

  if (!documentSymbols || documentSymbols.length === 0) {
    return undefined;
  }

  const methodLocationMap = new Map<string, vscode.Location>();
  for (const methodName of methodNames) {
    if (!methodLocationMap.has(methodName)) {
      const methodLocation = findMethodInSymbols(documentSymbols, methodName, uri);
      if (methodLocation) {
        methodLocationMap.set(methodName, methodLocation);
      }
    }
  }

  // If we found at least one method, return the map (even if some methods weren't found)
  // This allows partial success rather than complete failure
  return methodLocationMap.size > 0 ? methodLocationMap : undefined;
};

/**
 * Convert API test discovery results to ApexTestMethod format with file locations.
 * Uses document symbols from the Language Server to get precise method positions.
 * Falls back to (0,0) if document symbols are not available.
 */
const convertApiToApexTestMethods = async (classes: ToolingTestClass[]): Promise<ApexTestMethod[]> => {
  // Extract class names from discovery results to drive file lookup
  const classNames = classes
    .filter(cls => cls.testMethods?.length > 0)
    .filter(cls => !hasNamespace(cls))
    .map(cls => cls.name);

  const classNameToUri = await buildClassToUriIndex(classNames);
  const apiByClassName = new Map<string, ToolingTestClass[]>();
  for (const cls of classes) {
    if (cls.testMethods?.length === 0) continue;
    // Only consider tests in the local (default) namespace; workspace index maps local files only
    if (hasNamespace(cls)) continue;
    const list = apiByClassName.get(cls.name) ?? [];
    list.push(cls);
    apiByClassName.set(cls.name, list);
  }

  const tests: ApexTestMethod[] = [];
  for (const [className, uri] of classNameToUri) {
    const apiEntries = apiByClassName.get(className);
    if (!apiEntries) continue;

    // Collect all method names for this class
    const methodNames = new Set<string>();
    for (const entry of apiEntries) {
      for (const testMethod of entry.testMethods ?? []) {
        methodNames.add(testMethod.name);
      }
    }

    // Get method locations from document symbols only
    const methodLocationMap = await getMethodLocationsFromSymbols(uri, Array.from(methodNames));
    const symbolsFound = methodLocationMap?.size ?? 0;
    const totalMethods = methodNames.size;

    // Log only if document symbols failed completely
    if (symbolsFound === 0 && totalMethods > 0) {
      console.log(`[TEST LOCATION] ${className}: Document symbols failed - found 0 of ${totalMethods} methods`);
    }

    // Use (0,0) as default for methods not found in document symbols
    const defaultLocation = new vscode.Location(
      uri,
      new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0))
    );

    const emitted = new Set<string>();
    for (const entry of apiEntries) {
      const definingType = getFullClassName(entry);
      for (const testMethod of entry.testMethods ?? []) {
        if (emitted.has(testMethod.name)) continue;
        const location = methodLocationMap?.get(testMethod.name) ?? defaultLocation;

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

/** Build an index of class baseName -> file URI by searching for specific class names */
export const buildClassToUriIndex = async (classNames: string[]): Promise<Map<string, vscode.Uri>> => {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder || classNames.length === 0) {
    return new Map<string, vscode.Uri>();
  }

  // In web mode with virtual file systems, findFiles might not work the same way
  // Return empty map to allow org-only classes to work
  if (process.env.ESBUILD_PLATFORM === 'web' && folder.uri.scheme !== 'file') {
    return new Map<string, vscode.Uri>();
  }

  try {
    const exclude = '{**/.sfdx/**,**/.sf/**,**/node_modules/**}';
    // Search for .cls files matching the discovered class names
    const pattern = new vscode.RelativePattern(folder, '**/*.cls');
    const files = await vscode.workspace.findFiles(pattern, exclude);

    // Filter to only files whose base name matches one of the discovered class names
    // In web mode, use path instead of fsPath
    const matchingFiles = files.filter(f => {
      const filePath = getUriPath(f);
      const base = path.parse(filePath).name;
      return classNames.includes(base);
    });

    // Sort by path length (shorter paths first) to prefer files closer to workspace root
    // Then create map, handling potential duplicates by keeping the first (shortest path)
    return new Map(
      matchingFiles
        .toSorted((a, b) => {
          const aPath = getUriPath(a);
          const bPath = getUriPath(b);
          return aPath.length - bPath.length;
        })
        .map(f => {
          const filePath = getUriPath(f);
          const base = path.parse(filePath).name;
          return [base, f];
        })
    );
  } catch (error) {
    console.error('[Apex Testing] Error building class to URI index:', error);
    return new Map<string, vscode.Uri>();
  }
};

/** Writes test result JSON file using FsService (works in both desktop and web modes) */
export const writeTestResultJson = async (result: TestResult, outputDir: string): Promise<void> => {
  const testRunId = result.summary?.testRunId;
  const jsonFilename = testRunId ? `test-result-${testRunId}.json` : 'test-result.json';
  const jsonFilePath = path.join(outputDir, jsonFilename);
  const jsonContent = JSON.stringify(result, null, 2);

  const servicesApi = await getServicesApi();
  const fsServiceLayer = Layer.mergeAll(
    servicesApi.services.FsService.Default,
    servicesApi.services.ChannelService.Default
  );

  await Effect.runPromise(
    servicesApi.services.FsService.pipe(
      Effect.flatMap(service => service.writeFile(jsonFilePath, jsonContent)),
      Effect.provide(fsServiceLayer)
    )
  );
};

/** Writes test result JSON file, using FsService in web mode and testService.writeResultFiles in desktop mode */
export const writeTestResultJsonFile = async (
  result: TestResult,
  outputDir: string,
  codeCoverage: boolean,
  testService: TestService
): Promise<void> => {
  // In web mode, use FsService since testService.writeResultFiles uses callback-style fs operations
  // In desktop mode, use testService.writeResultFiles which works correctly
  if (process.env.ESBUILD_PLATFORM === 'web') {
    try {
      await writeTestResultJson(result, outputDir);
    } catch (error) {
      // Log error but don't throw - test execution succeeded, just file writing failed
      console.error('Failed to write JSON test result file:', error);
    }
  } else {
    try {
      await testService.writeResultFiles(
        result,
        { resultFormats: [ResultFormat.json], dirPath: outputDir },
        codeCoverage
      );
    } catch (error) {
      // Log error but don't throw - test execution succeeded, just file writing failed
      console.error('Failed to write JSON test result file:', error);
    }
  }
};
