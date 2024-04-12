/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Transform, TransformCallback } from 'stream';
import { PerClassCoverage } from '../tests';
import { TransformOptions } from 'node:stream';
import { pushArrayToStream } from './utils';
import { elapsedTime } from '../utils';
import { LoggerLevel } from '@salesforce/core'; // replace with your actual import

export class CodeCoverageStringifyStream extends Transform {
  private outerPushed = false;
  private pushedInner = false;
  constructor(options?: TransformOptions) {
    super({ ...options, objectMode: true });
  }

  _transform(
    chunk: PerClassCoverage[],
    encoding: string,
    callback: TransformCallback
  ): void {
    try {
      // push '[' once to encapsulate the entire result as an array
      if (!this.outerPushed) {
        this.push('[');
        this.outerPushed = true;
      }
      // push a comma between each chunk except for the first one.
      if (this.pushedInner) {
        this.push(',');
      }
      this.pushedInner = true;
      this.push('[');
      // Loop over each PerClassCoverage object in the array
      chunk.forEach((coverage, index) => {
        // Transform the PerClassCoverage object and push it to the readable side of the stream
        this.transformCoverage(coverage);
        if (index < chunk.length - 1) {
          this.push(',');
        }
      });
      this.push(']');
      callback();
    } catch (error) {
      callback(error);
    }
  }

  _flush(callback: TransformCallback): void {
    // push the closing ']' when the source stream is complete
    if (this.outerPushed) {
      this.push(']');
    }
    callback();
  }

  @elapsedTime('elapsedTime', LoggerLevel.TRACE)
  private transformCoverage(perClassCoverage: PerClassCoverage): string {
    // Manually construct the string representation of the PerClassCoverage object
    const transformedData = '{';
    const { coverage, ...theRest } = perClassCoverage;
    // stringify all properties except coverage and strip off the closing '}'
    this.push(JSON.stringify(theRest).slice(0, -1));
    this.push(',"coverage":{');
    this.push('"coveredLines":[');
    pushArrayToStream(coverage.coveredLines ?? [], this);
    this.push('],"uncoveredLines":[');
    pushArrayToStream(coverage.uncoveredLines ?? [], this);
    this.push(']}}');

    return transformedData;
  }
}
