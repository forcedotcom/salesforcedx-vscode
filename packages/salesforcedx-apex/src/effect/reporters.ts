/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ReportLineEnding } from '../reporters/lineEnding';
import type { MarkdownTextReporterOptions } from '../reporters/markdownTextReporter';
import type { TestResult } from '../tests/types';
import * as Cause from 'effect/Cause';
import * as Chunk from 'effect/Chunk';
import * as Clock from 'effect/Clock';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import { formatJUnitChunks } from '../reporters/formatJUnit';
import { formatMarkdownTextChunks } from '../reporters/formatMarkdownText';
import { formatTapChunks } from '../reporters/formatTap';
import { formatHuman } from '../reporters/humanFormatting';
import { ApexReportError, causeMessage } from './errors';

export interface HumanReporterOptions {
  detailedCoverage?: boolean;
  concise?: boolean;
  showCategory?: boolean;
  lineEnding?: ReportLineEnding;
}

const formatReport = (format: string, render: () => string): Effect.Effect<string, ApexReportError> =>
  Effect.try({
    try: render,
    catch: cause => new ApexReportError({ format, message: causeMessage(cause), cause: causeMessage(cause) })
  });

const collectReportChunks = (format: string, chunks: Stream.Stream<string>): Effect.Effect<string, ApexReportError> =>
  Stream.runCollect(chunks).pipe(
    Effect.map(Chunk.join('')),
    Effect.catchAllCause(cause =>
      Effect.fail(
        new ApexReportError({
          format,
          message: cause.pipe(Cause.squash, causeMessage),
          cause: cause.pipe(Cause.squash, causeMessage)
        })
      )
    )
  );

const formatStream = (
  format: 'tap' | 'junit',
  createChunks: () => Stream.Stream<string>
): Effect.Effect<string, ApexReportError> =>
  Effect.try({
    try: createChunks,
    catch: cause => new ApexReportError({ format, message: causeMessage(cause), cause: causeMessage(cause) })
  }).pipe(Effect.flatMap(chunks => collectReportChunks(format, chunks)));

/** Formats a human-readable test report without owning a file or output stream. */
export const formatHumanReport = Effect.fn('Apex.formatHumanReport')(
  (testResult: TestResult, options: HumanReporterOptions = {}) =>
    formatReport('human', () => {
      const report = formatHuman(testResult, options.detailedCoverage ?? false, options.concise, options.showCategory);
      return options.lineEnding ? report.replaceAll(/\r\n|\r|\n/g, options.lineEnding) : report;
    })
);

export const formatTapReport = Effect.fn('Apex.formatTapReport')(
  (testResult: TestResult, epilog?: string[], lineEnding: ReportLineEnding = '\n') =>
    formatStream('tap', () => formatTapChunks(testResult, epilog, lineEnding))
);

export const formatJUnitReport = Effect.fn('Apex.formatJUnitReport')((testResult: TestResult) =>
  formatStream('junit', () => formatJUnitChunks(testResult))
);

/** Returns a chunked Markdown/text report stream; the default timestamp comes from the Effect clock. */
export const formatMarkdownTextReportStream = Effect.fn('Apex.formatMarkdownTextReportStream')(function* (
  testResult: TestResult,
  options: MarkdownTextReporterOptions = {}
) {
  const timestamp = options.timestamp ?? new Date(yield* Clock.currentTimeMillis);
  return yield* Effect.try({
    try: () => formatMarkdownTextChunks(testResult, { ...options, timestamp }),
    catch: cause => {
      const format = options.format ?? 'markdown';
      return new ApexReportError({ format, message: causeMessage(cause), cause: causeMessage(cause) });
    }
  });
});

/** Collects the Markdown/text stream for callers that need a complete string. */
export const formatMarkdownTextReport = Effect.fn('Apex.formatMarkdownTextReport')(function* (
  testResult: TestResult,
  options: MarkdownTextReporterOptions = {}
) {
  return yield* formatMarkdownTextReportStream(testResult, options).pipe(
    Effect.flatMap(chunks => collectReportChunks(options.format ?? 'markdown', chunks))
  );
});
