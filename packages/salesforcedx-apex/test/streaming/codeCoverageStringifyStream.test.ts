/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { CodeCoverageStringifyStream } from '../../src/streaming/codeCoverageStringifyStream';
import { PerClassCoverage } from '../../src/tests';

describe('CodeCoverageStringifyStream', () => {
  let stream: CodeCoverageStringifyStream;
  let data: PerClassCoverage[];

  beforeEach(() => {
    data = [
      {
        apexClassOrTriggerName: 'TestClass3',
        apexClassOrTriggerId: '01p3h00000KoP4UAAV',
        apexTestClassId: '01p3h00000KoP4VAAV',
        apexTestMethodName: 'testMethod3',
        numLinesCovered: 12,
        numLinesUncovered: 3,
        percentage: '80.00',
        coverage: {
          coveredLines: [26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37],
          uncoveredLines: [38, 39, 40]
        }
      },
      {
        apexClassOrTriggerName: 'TestClass4',
        apexClassOrTriggerId: '01p3h00000KoP4WAAV',
        apexTestClassId: '01p3h00000KoP4XAAV',
        apexTestMethodName: 'testMethod4',
        numLinesCovered: 15,
        numLinesUncovered: 0,
        percentage: '100.00',
        coverage: {
          coveredLines: [
            41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55
          ],
          uncoveredLines: []
        }
      }
    ];
    stream = new CodeCoverageStringifyStream();
  });

  it('should transform data correctly', (done) => {
    const expectedOutput = JSON.stringify([data]);

    let output = '';
    stream.on('data', (chunk: string) => {
      output += chunk;
    });

    stream.on('end', () => {
      expect(output).to.equal(expectedOutput);
      done();
    });

    stream.write(data);
    stream.end();
  });

  it('should handle empty data', (done) => {
    const expectedOutput = '[[]]';

    let output = '';
    stream.on('data', (chunk: string) => {
      output += chunk;
    });

    stream.on('end', () => {
      expect(output).to.equal(expectedOutput);
      done();
    });

    stream.write([]);
    stream.end();
  });
});
