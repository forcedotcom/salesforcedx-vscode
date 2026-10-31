/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Logger } from '@salesforce/core';
import { Readable, type ReadableOptions } from 'node:stream';
import { type TestResult } from '../tests/types';
import { elapsedTime, HeapMonitor } from '../utils';
import { formatMarkdownText } from './markdownFormatting';
import { type MarkdownTextReporterOptions } from './markdownTextReporter';

/** @internal Used by the co-repo Apex Testing extension; not part of the supported npm API. */
export type MarkdownTextFormatTransformerOptions = ReadableOptions & MarkdownTextReporterOptions;

/** @internal Used by the co-repo Apex Testing extension; not part of the supported npm API. */
export class MarkdownTextFormatTransformer extends Readable {
  private readonly logger: Logger;
  private readonly options: MarkdownTextReporterOptions;

  constructor(
    private readonly testResult: TestResult,
    options?: MarkdownTextFormatTransformerOptions
  ) {
    super(options);
    this.logger = Logger.childFromRoot('MarkdownTextFormatTransformer');
    this.options = { ...options, timestamp: options?.timestamp ?? new Date() };
  }

  _read(): void {
    this.logger.trace('starting format');
    HeapMonitor.getInstance().checkHeapSize('MarkdownTextFormatTransformer._read');
    this.push(this.format());
    this.push(null); // Signal the end of the stream
    this.logger.trace('finishing format');
    HeapMonitor.getInstance().checkHeapSize('MarkdownTextFormatTransformer._read');
  }

  @elapsedTime()
  private format(): string {
    return formatMarkdownText(this.testResult, this.options);
  }
}
