/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ToolingTestClass } from '../testDiscovery/schemas';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { getApexExtension } from '../coreExtensionUtils';
import { telemetryService } from '../telemetry/telemetry';
import { discoverTests, sourceIsLS } from '../testDiscovery/testDiscovery';
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
export const hasNamespace = (cls: ToolingTestClass): boolean => (cls.namespacePrefix?.trim() ?? '') !== '';

/**
 * Fetch tests from the Language Server via the Apex extension
 */
export const fetchFromLs = async (): Promise<{ tests: ApexTestMethod[]; durationMs: number }> => {
  const start = Date.now();
  telemetryService.sendEventData('apexTestDiscoveryStart', { source: 'ls' });

  try {
    const apexExtension = await getApexExtension();
    if (!apexExtension?.isActive) {
      return { tests: [], durationMs: Date.now() - start };
    }
    const apexApi = apexExtension.exports;
    if (!apexApi?.getApexTests) {
      return { tests: [], durationMs: Date.now() - start };
    }
    const tests = await apexApi.getApexTests();

    const durationMs = Date.now() - start;
    telemetryService.sendEventData('apexTestDiscoveryEnd', { source: 'ls' }, buildMeasuresFromTests(tests, durationMs));
    return { tests, durationMs };
  } catch (error) {
    const durationMs = Date.now() - start;
    console.debug('Failed to fetch tests from language server:', error);
    return { tests: [], durationMs };
  }
};

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
 * Returns Apex tests using the configured discovery source.
 * - ls: queries the Language Server via Apex extension
 * - api: queries the Tooling API Test Discovery endpoint
 * Also emits timing metrics and telemetry.
 */
export const getApexTests = async (): Promise<ApexTestMethod[]> => {
  // Fetch according to user selection
  const selected = sourceIsLS() ? await fetchFromLs() : await fetchFromApi();
  return selected.tests;
};

/**
 * Get language client status from Apex extension
 */
export const getLanguageClientStatus = async (): Promise<{
  isReady: () => boolean;
  isIndexing: () => boolean;
  failedToInitialize: () => boolean;
  getStatusMessage: () => string;
}> => {
  try {
    const apexExtension = await getApexExtension();
    if (!apexExtension?.isActive) {
      return {
        isReady: () => false,
        isIndexing: () => false,
        failedToInitialize: () => true,
        getStatusMessage: () => 'Apex extension is not active'
      };
    }
    const apexApi = apexExtension.exports;
    if (!apexApi?.languageClientManager) {
      return {
        isReady: () => false,
        isIndexing: () => false,
        failedToInitialize: () => true,
        getStatusMessage: () => 'Apex extension API is not available'
      };
    }
    return apexApi.languageClientManager.getStatus();
  } catch (error) {
    console.debug('Failed to get language client status:', error);
    return {
      isReady: () => false,
      isIndexing: () => false,
      failedToInitialize: () => true,
      getStatusMessage: () => 'Failed to get language client status'
    };
  }
};

const buildMeasuresFromTests = (tests: ApexTestMethod[], durationMs: number) => {
  const numClasses = new Set(tests.map(t => t.definingType)).size;
  const numMethods = tests.length;
  return { durationMs, numClasses, numMethods };
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
  try {
    const exclude = '{**/.sfdx/**,**/.sf/**,**/node_modules/**}';
    // Search for .cls files matching the discovered class names
    const pattern = new vscode.RelativePattern(folder, '**/*.cls');
    const files = await vscode.workspace.findFiles(pattern, exclude);

    // Filter to only files whose base name matches one of the discovered class names
    const matchingFiles = files.filter(f => {
      const base = path.parse(f.fsPath).name;
      return classNames.includes(base);
    });

    // Sort by path length (shorter paths first) to prefer files closer to workspace root
    // Then create map, handling potential duplicates by keeping the first (shortest path)
    return new Map(
      matchingFiles
        .toSorted((a, b) => a.fsPath.length - b.fsPath.length)
        .map(f => {
          const base = path.parse(f.fsPath).name;
          return [base, f];
        })
    );
  } catch {
    console.error('Error building class to URI index');
    return new Map<string, vscode.Uri>();
  }
};
