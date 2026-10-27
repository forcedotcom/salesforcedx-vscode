/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { MarkdownTextReporterOptions } from './markdownTextReporter';
import type { TestResult } from '../tests/types';
import { Logger } from '@salesforce/core';
import { Readable, type ReadableOptions } from 'node:stream';
import { elapsedTime, HeapMonitor } from '../utils';
<<<<<<< HEAD
import { pushReportChunks } from '../utils/pushReportChunks';
import { formatMarkdownTextChunks } from './formatMarkdownText';
=======
import { formatMarkdownText } from './formatMarkdownText';
>>>>>>> origin/sm/W-23839447

/** @internal Used by the co-repo Apex Testing extension; not part of the supported npm API. */
export type MarkdownTextFormatTransformerOptions = ReadableOptions & MarkdownTextReporterOptions;

/** @internal Used by the co-repo Apex Testing extension; not part of the supported npm API. */
export class MarkdownTextFormatTransformer extends Readable {
  private readonly logger = Logger.childFromRoot('MarkdownTextFormatTransformer');
<<<<<<< HEAD
  private readonly chunks: ReturnType<typeof formatMarkdownTextChunks>;
=======
  private readonly reportOptions: MarkdownTextReporterOptions;
>>>>>>> origin/sm/W-23839447

  constructor(
    private readonly testResult: TestResult,
    options?: MarkdownTextFormatTransformerOptions
  ) {
    super(options);
<<<<<<< HEAD
    this.chunks = formatMarkdownTextChunks(testResult, { ...options, timestamp: options?.timestamp ?? new Date() });
=======
    this.reportOptions = { ...options, timestamp: options?.timestamp ?? new Date() };
>>>>>>> origin/sm/W-23839447
  }

  @elapsedTime()
  _read(): void {
    this.logger.trace('starting format');
    HeapMonitor.getInstance().checkHeapSize('MarkdownTextFormatTransformer._read');
<<<<<<< HEAD
    pushReportChunks(this, this.chunks);
=======
    this.push(formatMarkdownText(this.testResult, this.reportOptions));
    this.push(null); // Signal the end of the stream.
>>>>>>> origin/sm/W-23839447
    this.logger.trace('finishing format');
    HeapMonitor.getInstance().checkHeapSize('MarkdownTextFormatTransformer._read');
  }
}
