/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TestResult } from '@salesforce/apex-node';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { type URI, Utils } from 'vscode-uri';

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
export const readTestRunIdFile = Effect.fn('testUtils.readTestRunIdFile')(
  function* (apexTestDir: URI) {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const fileUri = Utils.joinPath(apexTestDir, 'test-run-id.txt');
    const content = yield* api.services.FsService.readFile(fileUri);
    return content.trim();
  },
  Effect.orElseSucceed(() => undefined)
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
