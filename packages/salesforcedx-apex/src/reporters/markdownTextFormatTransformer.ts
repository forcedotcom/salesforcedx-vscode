/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { MarkdownTextReporterOptions } from './markdownTextReporter';
import type { TestResult } from '../tests/types';
import * as Clock from 'effect/Clock';
import * as Effect from 'effect/Effect';
import type { ReadableOptions } from 'node:stream';
import { reportStreamToReadable } from '../utils/reportStream';
import { formatMarkdownTextChunks } from './formatMarkdownText';

/** @internal Used by the co-repo Apex Testing extension; not part of the supported npm API. */
export type MarkdownTextFormatTransformerOptions = ReadableOptions & MarkdownTextReporterOptions;

/** @internal Node-readable adapter for the Effect Markdown/text reporter. */
export const MarkdownTextFormatTransformer = Effect.fn('Apex.MarkdownTextFormatTransformer')(function* (
  testResult: TestResult,
  options?: MarkdownTextFormatTransformerOptions
) {
  const timestamp = options?.timestamp ?? new Date(yield* Clock.currentTimeMillis);
  return yield* Effect.sync(() =>
    reportStreamToReadable(formatMarkdownTextChunks(testResult, { ...options, timestamp }), options)
  );
});
