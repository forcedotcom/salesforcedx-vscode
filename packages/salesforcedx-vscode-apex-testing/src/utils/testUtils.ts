/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TestResult } from '@salesforce/apex-node';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { getApexTestingRuntime } from '../services/extensionProvider';

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
  uri: URI
): vscode.Location | undefined => {
  // Extract the base method name from the symbol (remove return type and parameters)
  const methodSymbol = symbols.find(
    symbol => symbol.kind === vscode.SymbolKind.Method && extractMethodName(symbol.name) === methodName
  );
  if (methodSymbol) {
    return new vscode.Location(uri, methodSymbol.range);
  }
  // Recursively search in children (nested classes)
  return symbols
    .map(symbol => (symbol.children?.length > 0 ? findMethodInSymbols(symbol.children, methodName, uri) : undefined))
    .find(location => location !== undefined);
};

/**
 * Get method locations from document symbols for a given URI and method names.
 * Returns a map of method names to their locations, or undefined if symbols are not available.
 */
export const getMethodLocationsFromSymbols = async (
  uri: URI,
  methodNames: string[]
): Promise<Map<string, vscode.Location> | undefined> => {
  // Ensure the document is accessible - try to open it if needed
  const isDocumentOpen = vscode.workspace.textDocuments.some(doc => doc.uri.toString() === uri.toString());
  if (!isDocumentOpen) {
    // Document might not be open, try to open it. If we can't, document symbols won't be available.
    const opened = await vscode.workspace.openTextDocument(uri).then(
      () => true,
      () => false
    );
    if (!opened) {
      return undefined;
    }
  }

  const documentSymbols = await vscode.commands
    .executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', uri)
    // If document symbols are not available, return undefined
    .then(undefined, () => undefined);

  if (!documentSymbols || documentSymbols.length === 0) {
    return undefined;
  }

  const methodLocationMap = new Map<string, vscode.Location>();
  methodNames.forEach(methodName => {
    if (!methodLocationMap.has(methodName)) {
      const methodLocation = findMethodInSymbols(documentSymbols, methodName, uri);
      if (methodLocation) {
        methodLocationMap.set(methodName, methodLocation);
      }
    }
  });

  // If we found at least one method, return the map (even if some methods weren't found)
  // This allows partial success rather than complete failure
  return methodLocationMap.size > 0 ? methodLocationMap : undefined;
};

/** Build an index of class baseName -> file URI using ComponentSet (works on web and desktop) */
export const buildClassToUriIndex = async (classNames: string[]): Promise<Map<string, URI>> => {
  if (classNames.length === 0) {
    return new Map<string, URI>();
  }

  return getApexTestingRuntime().runPromise(
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
      const index = new Map<string, URI>();

      yield* Effect.forEach(
        Array.from(componentSet.getSourceComponents()),
        component =>
          Effect.gen(function* () {
            // component.content is the .cls file path
            if (component.content && classNameSet.has(component.name)) {
              // Prefer shorter paths (files closer to workspace root)
              const existingUri = index.get(component.name);
              if (
                !existingUri ||
                component.content.length < (yield* api.services.FsService.uriToPath(existingUri)).length
              ) {
                index.set(component.name, URI.file(component.content));
              }
            }
          }),
        { concurrency: 1, discard: true }
      );

      return index;
    }).pipe(
      Effect.withSpan('buildClassToUriIndex', { attributes: { classCount: classNames.length } }),
      Effect.catchAll(error =>
        Effect.logError('Error building class to URI index', { error }).pipe(Effect.as(new Map<string, URI>()))
      )
    )
  );
};

/** Writes test result JSON file using FsService (works in both desktop and web modes) */
const writeTestResultJson = Effect.fn('testUtils.writeTestResultJson')(function* (result: TestResult, outputDir: URI) {
  const testRunId = result.summary?.testRunId;
  const jsonFilename = testRunId ? `test-result-${testRunId}.json` : 'test-result.json';
  const jsonContent = JSON.stringify(result, null, 2);
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const jsonFileUri = Utils.joinPath(outputDir, jsonFilename);
  yield* api.services.FsService.safeWriteFile(jsonFileUri, jsonContent);
});

/** Writes test-run-id.txt using FsService (works in both desktop and web) so file watcher and controller can read it */
const writeTestRunIdFile = Effect.fn('testUtils.writeTestRunIdFile')(function* (result: TestResult, outputDir: URI) {
  const testRunId = result.summary?.testRunId;
  if (!testRunId) {
    return;
  }
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fileUri = Utils.joinPath(outputDir, 'test-run-id.txt');
  yield* api.services.FsService.writeFile(fileUri, testRunId);
});

/** Writes test-result-<runId>-codecoverage.json using FsService (same content as apex-node writeResultFiles; works on web and desktop) */
const writeCodeCoverageJson = Effect.fn('testUtils.writeCodeCoverageJson')(function* (
  result: TestResult,
  outputDir: URI
) {
  const testRunId = result.summary?.testRunId;
  if (!testRunId || !result.tests?.length) {
    return;
  }
  const coverageData = result.tests
    .map(record => record.perClassCoverage)
    .filter((pcc): pcc is NonNullable<typeof pcc> => Boolean(pcc?.length));
  const jsonContent = JSON.stringify(coverageData, null, 2);
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const jsonFileUri = Utils.joinPath(outputDir, `test-result-${testRunId}-codecoverage.json`);
  yield* api.services.FsService.writeFile(jsonFileUri, jsonContent);
});

/** Reads test-run-id.txt using FsService (works in both desktop and web) */
export const readTestRunIdFile = async (apexTestDir: URI): Promise<string | undefined> =>
  getApexTestingRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const fileUri = Utils.joinPath(apexTestDir, 'test-run-id.txt');
      const content = yield* api.services.FsService.readFile(fileUri);
      return content.trim();
    }).pipe(Effect.catchAll(() => Effect.succeed(undefined)))
  );

/**
 * Writes test result JSON file (result + run-id + optional coverage) via FsService (works on web and
 * desktop). Surfaces FsServiceError on the error channel; callers decide fatality (both current callers
 * treat a write failure as non-fatal and log + continue).
 */
export const writeTestResultJsonFile = Effect.fn('testUtils.writeTestResultJsonFile')(function* (
  result: TestResult,
  outputDir: URI,
  codeCoverage: boolean
) {
  yield* writeTestResultJson(result, outputDir);
  yield* writeTestRunIdFile(result, outputDir);
  if (codeCoverage) {
    yield* writeCodeCoverageJson(result, outputDir);
  }
});
