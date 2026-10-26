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
import { formatJUnit, formatJUnitProperties, formatJUnitTestCases } from './formatJUnit';

export class JUnitFormatTransformer extends Readable {
  private readonly logger = Logger.childFromRoot('JUnitFormatTransformer');

  constructor(
    private readonly testResult: TestResult,
    options?: ReadableOptions
  ) {
    super(options);
  }

  _read(): void {
    this.logger.trace('starting _read');
    HeapMonitor.getInstance().checkHeapSize('JUnitFormatTransformer._read');
    this.format();
    this.push(null); // Signal the end of the stream.
    this.logger.trace('finishing _read');
    HeapMonitor.getInstance().checkHeapSize('JUnitFormatTransformer._read');
  }

  @elapsedTime()
  public format(): void {
    this.push(formatJUnit(this.testResult));
  }

  @elapsedTime()
  buildProperties(): void {
    this.push(formatJUnitProperties(this.testResult));
  }

  @elapsedTime()
  buildTestCases(): void {
    this.push(formatJUnitTestCases(this.testResult.tests));
  }
}
