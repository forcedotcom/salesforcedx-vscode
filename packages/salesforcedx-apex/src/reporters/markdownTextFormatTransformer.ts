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
import { pushReportChunks } from '../utils/pushReportChunks';
import { formatMarkdownTextChunks } from './formatMarkdownText';

/** @internal Used by the co-repo Apex Testing extension; not part of the supported npm API. */
export type MarkdownTextFormatTransformerOptions = ReadableOptions & MarkdownTextReporterOptions;

/** @internal Used by the co-repo Apex Testing extension; not part of the supported npm API. */
export class MarkdownTextFormatTransformer extends Readable {
  private readonly logger = Logger.childFromRoot('MarkdownTextFormatTransformer');
  private readonly chunks: ReturnType<typeof formatMarkdownTextChunks>;

  constructor(testResult: TestResult, options?: MarkdownTextFormatTransformerOptions) {
    super(options);
    this.chunks = formatMarkdownTextChunks(testResult, { ...options, timestamp: options?.timestamp ?? new Date() });
  }

  @elapsedTime()
  _read(): void {
    this.logger.trace('starting format');
    HeapMonitor.getInstance().checkHeapSize('MarkdownTextFormatTransformer._read');
    pushReportChunks(this, this.chunks);
    this.logger.trace('finishing format');
    HeapMonitor.getInstance().checkHeapSize('MarkdownTextFormatTransformer._read');
  }
}
