/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Logger } from '@salesforce/core';
import { Readable, ReadableOptions } from 'node:stream';
import {
  ApexTestResultData,
  ApexTestResultOutcome,
  TestResult
} from '../tests';
import { elapsedTime, HeapMonitor } from '../utils';
import { buildTapDiagnostics } from './buildTapDiagnostics';

type TapFormatTransformerOptions = ReadableOptions & {
  bufferSize?: number;
};

export class TapFormatTransformer extends Readable {
  private readonly logger: Logger;
  private testResult: TestResult;
  private epilogue?: string[];
  private buffer: string;
  private bufferSize: number;

  constructor(
    testResult: TestResult,
    epilogue?: string[],
    options?: TapFormatTransformerOptions
  ) {
    super(options);
    this.testResult = testResult;
    this.epilogue = epilogue;
    this.logger = Logger.childFromRoot('TapFormatTransformer');
    this.buffer = '';
    this.bufferSize = options?.bufferSize || 256; // Default buffer size is 256
  }

  private pushToBuffer(chunk: string): void {
    this.buffer += chunk;
    if (this.buffer.length >= this.bufferSize) {
      this.push(this.buffer);
      this.buffer = '';
    }
  }

  _read(): void {
    this.logger.trace('starting format');
    HeapMonitor.getInstance().checkHeapSize('TapFormatTransformer._read');
    this.format();
    if (this.buffer.length > 0) {
      this.push(this.buffer);
    }
    this.push(null); // Signal the end of the stream
    this.logger.trace('finishing format');
    HeapMonitor.getInstance().checkHeapSize('TapFormatTransformer._read');
  }

  @elapsedTime()
  public format(): void {
    const testPointCount = this.testResult.tests.length;

    this.pushToBuffer(`1..${testPointCount}\n`);
    this.buildTapResults();

    this.epilogue?.forEach((c) => {
      this.pushToBuffer(`# ${c}\n`);
    });
  }

  @elapsedTime()
  public buildTapResults(): void {
    this.testResult.tests.forEach((test: ApexTestResultData, index: number) => {
      const testNumber = index + 1;
      const outcome =
        test.outcome === ApexTestResultOutcome.Pass ? 'ok' : 'not ok';
      this.pushToBuffer(`${outcome} ${testNumber} ${test.fullName}\n`);
      buildTapDiagnostics(test).forEach((s) => {
        this.pushToBuffer(`# ${s}\n`);
      });
    });
  }
}
