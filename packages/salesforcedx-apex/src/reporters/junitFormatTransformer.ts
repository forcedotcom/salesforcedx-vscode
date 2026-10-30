/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { TestResult } from '../tests/types';
import { Logger } from '@salesforce/core';
import { Readable, type ReadableOptions } from 'node:stream';
import { elapsedTime, HeapMonitor } from '../utils';
import { pushReportChunks } from '../utils/pushReportChunks';
import { formatJUnitChunks, formatJUnitPropertyChunks, formatJUnitTestCaseChunks } from './formatJUnit';

export class JUnitFormatTransformer extends Readable {
  private readonly logger = Logger.childFromRoot('JUnitFormatTransformer');
  private readonly chunks: ReturnType<typeof formatJUnitChunks>;

  constructor(
    private readonly testResult: TestResult,
    options?: ReadableOptions
  ) {
    super(options);
    this.chunks = formatJUnitChunks(testResult);
  }

  _read(): void {
    this.logger.trace('starting _read');
    HeapMonitor.getInstance().checkHeapSize('JUnitFormatTransformer._read');
    this.format();
    this.logger.trace('finishing _read');
    HeapMonitor.getInstance().checkHeapSize('JUnitFormatTransformer._read');
  }

  @elapsedTime()
  public format(): void {
    pushReportChunks(this, this.chunks);
  }

  @elapsedTime()
  buildProperties(): void {
    for (const chunk of formatJUnitPropertyChunks(this.testResult)) this.push(chunk);
  }

  @elapsedTime()
  buildTestCases(): void {
    for (const chunk of formatJUnitTestCaseChunks(this.testResult.tests)) this.push(chunk);
  }
}
