/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ApexReportError } from './errors';
import type { MarkdownTextReporterOptions } from '../reporters/markdownTextReporter';
import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import { isNotUndefined } from 'effect/Predicate';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { nls } from '../i18n';
import { formatJUnitChunks } from '../reporters/formatJUnit';
import { formatTapChunks } from '../reporters/formatTap';
import { stringifyTestResultChunks } from '../streaming/testResultStringify';
import {
  type OutputDirConfig,
  type ResultFileFormat,
  ResultFileFormatsSchema,
  ResultFormatsSchema,
  type TestResult,
  type TestRunIdResult
} from '../tests/types';
import { FileOutput, FileOutputError, PartialResultFilesError } from './fileOutput';
import { formatMarkdownTextReportStream } from './reporters';

export interface WriteResultFilesOptions extends MarkdownTextReporterOptions {
  /** Write the run ID sidecar when a run ID exists. Defaults to true. */
  writeTestRunId?: boolean;
  /** Include setup results in compact result JSON. Defaults to false for apex-node parity. */
  includeSetup?: boolean;
  codeCoverage?: boolean;
}

const decodeResultFormats = Schema.decodeUnknownSync(
  ResultFormatsSchema.pipe(
    Schema.annotations({ message: () => ({ message: nls.localize('resultFormatErr'), override: true }) })
  )
);
const decodeResultFileFormats = Schema.decodeUnknownSync(
  ResultFileFormatsSchema.pipe(
    Schema.annotations({ message: () => ({ message: nls.localize('resultFileFormatErr'), override: true }) })
  )
);

const stringifyJsonArrayChunks = function* <A>(values: readonly A[]): Generator<string> {
  yield '[';
  for (const [index, value] of values.entries()) {
    if (index > 0) yield ',';
    yield JSON.stringify(value) ?? 'null';
  }
  yield ']';
};

const fileNameForResultFormat = (format: ResultFileFormat, fileId: string): string => {
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
  }
};

const writeFiles = Effect.fn('Apex.writeResultFiles.writeFiles')(function* (
  result: TestResult | TestRunIdResult,
  outputDirConfig: OutputDirConfig,
  options: WriteResultFilesOptions = {}
) {
  const fileOutput = yield* FileOutput;
  const { dirPath, fileInfos } = outputDirConfig;
  const resultFormats = decodeResultFormats(outputDirConfig.resultFormats);
  const testResult = 'summary' in result ? result : undefined;
  const fileFormats = resultFormats && testResult ? decodeResultFileFormats(resultFormats) : [];
  yield* fileOutput.createDirectory(dirPath);

  const testRunId = 'summary' in result ? result.summary.testRunId : result.testRunId;
  const fileId = testRunId || 'default';
  const testRunIdFiles =
    options.writeTestRunId !== false && isNotUndefined(testRunId)
      ? yield* fileOutput.writeFile(dirPath, 'test-run-id.txt', Stream.make(testRunId)).pipe(Effect.map(path => [path]))
      : [];

  const resultFiles = yield* Effect.forEach(
    testResult ? fileFormats.map(format => ({ format, testResult })) : [],
    Effect.fn('Apex.writeResultFiles.writeReport')(function* ({ format, testResult }) {
      const fileName = fileNameForResultFormat(format, fileId);

      switch (format) {
        case 'json':
          return yield* fileOutput.writeFile(
            dirPath,
            fileName,
            Stream.fromIterable(stringifyTestResultChunks(testResult, { includeSetup: options.includeSetup }))
          );
        case 'tap':
          return yield* fileOutput.writeFile(dirPath, fileName, formatTapChunks(testResult));
        case 'junit':
          return yield* fileOutput.writeFile(dirPath, fileName, formatJUnitChunks(testResult));
        case 'markdown':
        case 'text': {
          const chunks = yield* formatMarkdownTextReportStream(testResult, {
            ...options,
            format,
            codeCoverage: options.codeCoverage
          });
          return yield* fileOutput.writeFile(dirPath, fileName, chunks);
        }
      }
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
                  .filter(coverage => isNotUndefined(coverage) && coverage.length > 0)
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

/** Writes results in order, preserving complete output and reporting committed paths on failure. */
export const writeResultFiles = Effect.fn('Apex.writeResultFiles')(function* (
  result: TestResult | TestRunIdResult,
  outputDirConfig: OutputDirConfig,
  options: WriteResultFilesOptions = {}
) {
  const fileOutput = yield* FileOutput;
  const writtenFiles = yield* Ref.make<readonly string[]>([]);
  const onFailure = (cause: FileOutputError | ApexReportError) =>
    Ref.get(writtenFiles).pipe(
      Effect.flatMap(paths =>
        Effect.fail(
          Arr.isNonEmptyReadonlyArray(paths)
            ? new PartialResultFilesError({ writtenFiles: paths, message: cause.message, cause })
            : cause
        )
      )
    );
  return yield* writeFiles(result, outputDirConfig, options).pipe(
    Effect.provideService(FileOutput, {
      ...fileOutput,
      writeFile: (...args) =>
        fileOutput.writeFile(...args).pipe(Effect.tap(path => Ref.update(writtenFiles, paths => [...paths, path])))
    }),
    Effect.catchTags({ FileOutputError: onFailure, ApexReportError: onFailure })
  );
});
