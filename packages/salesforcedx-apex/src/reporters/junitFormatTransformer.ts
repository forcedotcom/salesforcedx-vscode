/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Logger } from '@salesforce/core';
import { Readable, type ReadableOptions } from 'node:stream';
import { type TestResult } from '../tests/types';
import { formatJUnit, formatJUnitProperties, formatJUnitTestCases } from './junitFormatting';

export class JUnitFormatTransformer extends Readable {
  private readonly logger: Logger;

  constructor(
    private readonly testResult: TestResult,
    options?: ReadableOptions
  ) {
    super(options);
    this.logger = Logger.childFromRoot('JUnitFormatTransformer');
  }

  _read(): void {
    this.logger.trace('starting _read');
    this.push(this.format());
    this.push(null); // Signal the end of the stream
    this.logger.trace('finishing _read');
  }

  public format(): string {
    return formatJUnit(this.testResult);
  }

  buildProperties(): string {
    return formatJUnitProperties(this.testResult.summary);
  }

  buildTestCases(): string {
    return formatJUnitTestCases(this.testResult.tests);
  }
}
