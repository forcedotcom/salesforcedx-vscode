/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Logger } from '@salesforce/core';
import { Readable, type ReadableOptions } from 'node:stream';
import { type TestResult } from '../tests/types';
import { elapsedTime, HeapMonitor } from '../utils';
import { buildTapResults, formatTap, formatTapResults } from './tapFormatting';

export class TapFormatTransformer extends Readable {
  private readonly logger: Logger;
  private readonly testResult: TestResult;
  private readonly epilogue?: string[];

  constructor(testResult: TestResult, epilogue?: string[], options?: ReadableOptions) {
    super(options);
    this.testResult = testResult;
    this.epilogue = epilogue;
    this.logger = Logger.childFromRoot('TapFormatTransformer');
  }

  _read(): void {
    this.logger.trace('starting format');
    HeapMonitor.getInstance().checkHeapSize('TapFormatTransformer._read');
    this.push(this.format());
    this.push(null); // Signal the end of the stream
    this.logger.trace('finishing format');
    HeapMonitor.getInstance().checkHeapSize('TapFormatTransformer._read');
  }

  @elapsedTime()
  public format(): string {
    return formatTap(buildTapResults(this.testResult), this.epilogue);
  }

  @elapsedTime()
  public buildTapResults(): string {
    return formatTapResults(buildTapResults(this.testResult));
  }
}
