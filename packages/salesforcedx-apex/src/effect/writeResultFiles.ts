/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { MarkdownTextReporterOptions } from '../reporters/markdownTextReporter.js';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { nls } from '../i18n/index.js';
import { formatJUnitChunks } from '../reporters/formatJUnit.js';
import { formatTapChunks } from '../reporters/formatTap.js';
import { stringifyTestResultChunks } from '../streaming/testResultStringify.js';
import { type OutputDirConfig, type TestResult, type TestRunIdResult } from '../tests/apiTypes.js';
import { FileOutput, FileOutputError } from './fileOutput.js';
import { formatMarkdownTextReportStream } from './reporters.js';
import { ResultFileFormatsSchema, ResultFormatsSchema } from './testTypes.js';

export interface WriteResultFilesOptions extends MarkdownTextReporterOptions {
  /** Write the run ID sidecar when a run ID exists. Defaults to true. */
  writeTestRunId?: boolean;
  /** Include setup results in compact result JSON. Defaults to false for apex-node parity. */
  includeSetup?: boolean;
  codeCoverage?: boolean;
}

const assertResultFormats = (value: unknown): void => {
  try {
    Schema.decodeUnknownSync(ResultFormatsSchema)(value);
  } catch {
    throw new Error(nls.localize('resultFormatErr'));
  }
};
const assertResultFileFormats = (value: unknown): void => {
  try {
    Schema.decodeUnknownSync(ResultFileFormatsSchema)(value);
  } catch {
    throw new Error(nls.localize('resultFileFormatErr'));
  }
};

const stringifyJsonArrayChunks = function* <A>(values: readonly A[]): Generator<string> {
  yield '[';
  for (const [index, value] of values.entries()) {
    if (index > 0) yield ',';
    yield JSON.stringify(value) ?? 'null';
  }
  yield ']';
};

const fileNameForResultFormat = (format: string, fileId: string): string | undefined => {
  switch (format) {
    case 'json':
      return `test-result-${fileId}.json`;
    case 'tap':
      return `test-result-${fileId}-tap.txt`;
    case 'junit':
      return `test-result-${fileId}-junit.xml`;
    case 'markdown':
      return `test-result-${fileId}.md`;
    case 'text':
      return `test-result-${fileId}.txt`;
    default:
      return undefined;
  }
};

/** Writes requested test result files through the caller's file output implementation. */
export const writeResultFiles = Effect.fn('Apex.writeResultFiles')(function* (
  result: TestResult | TestRunIdResult,
  outputDirConfig: OutputDirConfig,
  options: WriteResultFilesOptions = {}
) {
  const fileOutput = yield* FileOutput;
  const { dirPath, resultFormats, fileInfos } = outputDirConfig;
  assertResultFormats(resultFormats);
  yield* fileOutput.createDirectory(dirPath);

  const testResult = 'summary' in result ? result : undefined;
  const testRunId = 'summary' in result ? result.summary.testRunId : result.testRunId;
  const fileId = testRunId || 'default';
  const testRunIdFiles =
    options.writeTestRunId !== false && isNotUndefined(testRunId)
      ? yield* fileOutput.writeFile(dirPath, 'test-run-id.txt', Stream.make(testRunId)).pipe(
          Effect.map(path => [path]),
          Effect.catch(error => Effect.logError('Error writing file', { error }).pipe(Effect.as([])))
        )
      : [];

  if (resultFormats && testResult) assertResultFileFormats(resultFormats);
  const resultFiles = yield* Effect.forEach(
    resultFormats && testResult ? resultFormats.map(format => ({ format, testResult })) : [],
    Effect.fn('Apex.writeResultFiles.writeReport')(function* ({ format, testResult }) {
      const fileName = fileNameForResultFormat(format, fileId);
      if (fileName === undefined) return yield* Effect.die(new Error(nls.localize('resultFormatErr')));

      if (format === 'json') {
        return yield* fileOutput.writeFile(
          dirPath,
          fileName,
          Stream.fromIterable(stringifyTestResultChunks(testResult, { includeSetup: options.includeSetup }))
        );
      }
      if (format === 'tap') return yield* fileOutput.writeFile(dirPath, fileName, formatTapChunks(testResult));
      if (format === 'junit') return yield* fileOutput.writeFile(dirPath, fileName, formatJUnitChunks(testResult));

      if (format === 'markdown' || format === 'text') {
        const chunks = yield* formatMarkdownTextReportStream(testResult, {
          ...options,
          format,
          codeCoverage: options.codeCoverage
        });
        return yield* fileOutput.writeFile(dirPath, fileName, chunks);
      }
      return yield* Effect.die(new Error(nls.localize('resultFormatErr')));
    }),
    { concurrency: 1 }
  );

  const coverageFiles =
    options.codeCoverage && testResult
      ? yield* fileOutput
          .writeFile(
            dirPath,
            `test-result-${fileId}-codecoverage.json`,
            Stream.fromIterable(
              stringifyJsonArrayChunks(
                testResult.tests
                  .map(test => test.perClassCoverage)
                  .filter(coverage => coverage !== undefined && coverage.length > 0)
              )
            )
          )
          .pipe(Effect.map(path => [path]))
      : [];

  const infoFiles = fileInfos
    ? yield* Effect.forEach(
        fileInfos,
        Effect.fn('Apex.writeResultFiles.writeFileInfo')(function* ({ filename, content }) {
          const fileContent =
            typeof content === 'string'
              ? content
              : yield* Effect.try({
                  try: () => JSON.stringify(content) ?? 'null',
                  catch: cause =>
                    new FileOutputError({
                      operation: 'serialize',
                      path: `${dirPath}/${filename}`,
                      message: `Could not serialize ${filename}: ${String(cause)}`
                    })
                });
          return yield* fileOutput.writeFile(dirPath, filename, Stream.make(fileContent));
        }),
        { concurrency: 1 }
      )
    : [];

  return [...testRunIdFiles, ...resultFiles, ...coverageFiles, ...infoFiles];
});

const isNotUndefined = <A>(value: A | undefined): value is A => value !== undefined;
