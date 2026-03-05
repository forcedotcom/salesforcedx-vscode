/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ToolingTestClass } from '../testDiscovery/schemas';
import { TestResult, TestService } from '@salesforce/apex-node';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { AllServicesLayer } from '../services/extensionProvider';
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
  // Effect.withSpan handles telemetry automatically
  const result = await Effect.runPromise(discoverTests({ namespacePrefix: options?.namespacePrefix }));
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
  const nonNamespaceClassesWithTestMethods = classes
    .filter(cls => cls.testMethods?.length > 0)
    .filter(cls => !hasNamespace(cls));
  const classNameToUri = await buildClassToUriIndex(nonNamespaceClassesWithTestMethods.map(cls => cls.name));
  const apiByClassName = Map.groupBy(nonNamespaceClassesWithTestMethods, cls => cls.name);

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

/** Build an index of class baseName -> file URI using ComponentSet (works on web and desktop) */
export const buildClassToUriIndex = async (classNames: string[]): Promise<Map<string, vscode.Uri>> => {
  if (classNames.length === 0) {
    return new Map<string, vscode.Uri>();
  }

  return Effect.runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;

      // Get package directories from the project
      const sfProject = yield* api.services.ProjectService.getSfProject();
      const packageDirs = sfProject.getPackageDirectories().map(dir => dir.fullPath);

      // Build ComponentSet for all ApexClass files in the project
      const componentSet = yield* api.services.MetadataRetrieveService.buildComponentSetFromSource(packageDirs, [
        { type: 'ApexClass', fullName: '*' }
      ]);

      // Build index from component name to file URI
      const classNameSet = new Set(classNames);
      const index = new Map<string, vscode.Uri>();

      for (const component of componentSet.getSourceComponents()) {
        // component.content is the .cls file path
        if (component.content && classNameSet.has(component.name)) {
          // Prefer shorter paths (files closer to workspace root)
          const existingUri = index.get(component.name);
          if (!existingUri || component.content.length < getUriPath(existingUri).length) {
            index.set(component.name, URI.file(component.content));
          }
        }
      }

      return index;
    }).pipe(
      Effect.withSpan('buildClassToUriIndex', { attributes: { classCount: classNames.length } }),
      Effect.catchAll(error => {
        console.error('[Apex Testing] Error building class to URI index:', error);
        return Effect.succeed(new Map<string, vscode.Uri>());
      }),
      Effect.provide(AllServicesLayer)
    )
  );
};

/** Get Apex class and test suite file URIs via ComponentSetService (works on web and desktop; same approach as org-browser / metadata). */
export const findLocalApexClassAndTestSuiteUris = async (): Promise<{
  apexClassUris: vscode.Uri[];
  testSuiteUris: vscode.Uri[];
}> => {
  const empty: { apexClassUris: vscode.Uri[]; testSuiteUris: vscode.Uri[] } = {
    apexClassUris: [],
    testSuiteUris: []
  };
  const effect = Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const componentSet = yield* api.services.ComponentSetService.getComponentSetFromProjectDirectories();
    const apexClassUris: vscode.Uri[] = [];
    const testSuiteUris: vscode.Uri[] = [];
    for (const comp of componentSet.getSourceComponents()) {
      const typeName = comp.type?.name ?? '';
      if (typeName === 'ApexClass' && comp.content) {
        apexClassUris.push(vscode.Uri.file(comp.content));
      } else if (typeName === 'ApexTestSuite') {
        const filePath = comp.xml ?? comp.content ?? comp.walkContent?.()?.[0];
        if (filePath) {
          testSuiteUris.push(vscode.Uri.file(filePath));
        }
      }
    }
    const sort = (a: vscode.Uri, b: vscode.Uri) => (a.fsPath ?? a.path).localeCompare(b.fsPath ?? b.path);
    return {
      apexClassUris: apexClassUris.toSorted(sort),
      testSuiteUris: testSuiteUris.toSorted(sort)
    };
  }).pipe(
    Effect.provide(AllServicesLayer),
    Effect.catchAll(() => Effect.succeed(empty))
  );
  const typedEffect: Effect.Effect<typeof empty, never, never> = effect;
  return Effect.runPromise(typedEffect);
};

/** Writes test result JSON file using FsService (works in both desktop and web modes) */
export const writeTestResultJson = async (result: TestResult, outputDir: string | vscode.Uri): Promise<void> => {
  const testRunId = result.summary?.testRunId;
  const jsonFilename = testRunId ? `test-result-${testRunId}.json` : 'test-result.json';
  const jsonContent = JSON.stringify(result, null, 2);
  await Effect.runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const outputDirUri = yield* api.services.FsService.toUri(outputDir);
      const jsonFileUri = Utils.joinPath(outputDirUri, jsonFilename);
      yield* api.services.FsService.writeFile(jsonFileUri, jsonContent);
    }).pipe(Effect.provide(AllServicesLayer))
  );
};

/** Writes test-run-id.txt using FsService (works in both desktop and web) so file watcher and controller can read it */
export const writeTestRunIdFile = async (result: TestResult, outputDir: string | vscode.Uri): Promise<void> => {
  const testRunId = result.summary?.testRunId;
  if (!testRunId) {
    return;
  }
  await Effect.runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const outputDirUri = yield* api.services.FsService.toUri(outputDir);
      const fileUri = Utils.joinPath(outputDirUri, 'test-run-id.txt');
      yield* api.services.FsService.writeFile(fileUri, testRunId);
    }).pipe(Effect.provide(AllServicesLayer))
  );
};

/** Writes test-result-<runId>-codecoverage.json using FsService (same content as apex-node writeResultFiles; works on web and desktop) */
export const writeCodeCoverageJson = async (result: TestResult, outputDir: string | vscode.Uri): Promise<void> => {
  const testRunId = result.summary?.testRunId;
  if (!testRunId || !result.tests?.length) {
    return;
  }
  const coverageData = result.tests
    .map(record => record.perClassCoverage)
    .filter((pcc): pcc is NonNullable<typeof pcc> => Boolean(pcc?.length));
  const jsonContent = JSON.stringify(coverageData, null, 2);
  await Effect.runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const outputDirUri = yield* api.services.FsService.toUri(outputDir);
      const jsonFileUri = Utils.joinPath(outputDirUri, `test-result-${testRunId}-codecoverage.json`);
      yield* api.services.FsService.writeFile(jsonFileUri, jsonContent);
    }).pipe(Effect.provide(AllServicesLayer))
  );
};

/** Reads test-run-id.txt using FsService (works in both desktop and web) */
export const readTestRunIdFile = async (apexTestPath: string | vscode.Uri): Promise<string | undefined> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const apexTestUri = yield* api.services.FsService.toUri(apexTestPath);
      const fileUri = Utils.joinPath(apexTestUri, 'test-run-id.txt');
      const content = yield* api.services.FsService.readFile(fileUri);
      return content.trim();
    }).pipe(
      Effect.provide(AllServicesLayer),
      Effect.catchAll(() => Effect.succeed(undefined))
    )
  );

const runFsServiceFallback = async (
  result: TestResult,
  outputDir: string | vscode.Uri,
  codeCoverage: boolean
): Promise<void> => {
  await writeTestResultJson(result, outputDir);
  await writeTestRunIdFile(result, outputDir);
  if (codeCoverage) {
    await writeCodeCoverageJson(result, outputDir);
  }
};

/** Writes test result JSON file via FsService (works on web and desktop) */
export const writeTestResultJsonFile = async (
  result: TestResult,
  outputDir: string | vscode.Uri,
  codeCoverage: boolean,
  _testService: TestService
): Promise<void> => {
  try {
    await runFsServiceFallback(result, outputDir, codeCoverage);
  } catch (error) {
    console.error('Failed to write JSON test result file:', error);
  }
};
