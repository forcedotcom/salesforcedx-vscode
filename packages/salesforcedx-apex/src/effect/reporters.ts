/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { MarkdownTextReporterOptions } from '../reporters/markdownTextReporter';
import type { TestResult } from '../tests/types';
import * as Clock from 'effect/Clock';
import * as Effect from 'effect/Effect';
import { formatHuman } from '../reporters/formatHuman';
import { formatJUnit } from '../reporters/formatJUnit';
import { formatMarkdownText } from '../reporters/formatMarkdownText';
import { formatTap } from '../reporters/formatTap';
import { ApexReportError, causeMessage } from './errors';

export interface HumanReporterOptions {
  detailedCoverage?: boolean;
  concise?: boolean;
  showCategory?: boolean;
  lineEnding?: '\n' | '\r\n';
}

const formatReport = (format: string, render: () => string): Effect.Effect<string, ApexReportError> =>
  Effect.try({
    try: render,
    catch: cause => new ApexReportError({ format, message: causeMessage(cause), cause: causeMessage(cause) })
  });

/** Formats a human-readable test report without owning a file or output stream. */
export const formatHumanReport = Effect.fn('Apex.formatHumanReport')(
  (testResult: TestResult, options: HumanReporterOptions = {}) =>
    formatReport('human', () =>
      formatHuman(
        testResult,
        options.detailedCoverage ?? false,
        options.concise,
        options.showCategory,
        options.lineEnding
      )
    )
);

export const formatTapReport = Effect.fn('Apex.formatTapReport')(
  (testResult: TestResult, epilog?: string[], lineEnding: '\n' | '\r\n' = '\n') =>
    formatReport('tap', () => formatTap(testResult, epilog, lineEnding))
);

export const formatJUnitReport = Effect.fn('Apex.formatJUnitReport')((testResult: TestResult) =>
  formatReport('junit', () => formatJUnit(testResult))
);

/** Preserves Markdown/text defaults; the default timestamp comes from the Effect clock. */
export const formatMarkdownTextReport = Effect.fn('Apex.formatMarkdownTextReport')(function* (
  testResult: TestResult,
  options: MarkdownTextReporterOptions = {}
) {
  const timestamp = options.timestamp ?? new Date(yield* Clock.currentTimeMillis);
  return yield* formatReport(options.format ?? 'markdown', () =>
    formatMarkdownText(testResult, { ...options, timestamp })
  );
});
