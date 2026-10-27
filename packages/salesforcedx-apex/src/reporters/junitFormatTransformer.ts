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
<<<<<<< HEAD
import { pushReportChunks } from '../utils/pushReportChunks';
import { formatJUnitChunks, formatJUnitPropertyChunks, formatJUnitTestCaseChunks } from './formatJUnit';

export class JUnitFormatTransformer extends Readable {
  private readonly logger = Logger.childFromRoot('JUnitFormatTransformer');
  private readonly chunks: ReturnType<typeof formatJUnitChunks>;
=======
import { formatJUnit, formatJUnitProperties, formatJUnitTestCases } from './formatJUnit';

export class JUnitFormatTransformer extends Readable {
  private readonly logger = Logger.childFromRoot('JUnitFormatTransformer');
>>>>>>> origin/sm/W-23839447

  constructor(
    private readonly testResult: TestResult,
    options?: ReadableOptions
  ) {
    super(options);
<<<<<<< HEAD
    this.chunks = formatJUnitChunks(testResult);
=======
>>>>>>> origin/sm/W-23839447
  }

  _read(): void {
    this.logger.trace('starting _read');
    HeapMonitor.getInstance().checkHeapSize('JUnitFormatTransformer._read');
    this.format();
<<<<<<< HEAD
=======
    this.push(null); // Signal the end of the stream.
>>>>>>> origin/sm/W-23839447
    this.logger.trace('finishing _read');
    HeapMonitor.getInstance().checkHeapSize('JUnitFormatTransformer._read');
  }

  @elapsedTime()
  public format(): void {
<<<<<<< HEAD
    pushReportChunks(this, this.chunks);
=======
    this.push(formatJUnit(this.testResult));
>>>>>>> origin/sm/W-23839447
  }

  @elapsedTime()
  buildProperties(): void {
<<<<<<< HEAD
    for (const chunk of formatJUnitPropertyChunks(this.testResult)) this.push(chunk);
=======
    this.push(formatJUnitProperties(this.testResult));
>>>>>>> origin/sm/W-23839447
  }

  @elapsedTime()
  buildTestCases(): void {
<<<<<<< HEAD
    for (const chunk of formatJUnitTestCaseChunks(this.testResult.tests)) this.push(chunk);
=======
    this.push(formatJUnitTestCases(this.testResult.tests));
>>>>>>> origin/sm/W-23839447
  }
}
