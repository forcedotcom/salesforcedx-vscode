/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { formatTap } from '../../src';
import { buildTapResults } from '../../src/reporters/tapFormatting';
import { testResults } from './testResults';
import { normalizeFormatterOutput } from './formattingSnapshot';

const expectSnapshot = (output: string): void => {
  expect(normalizeFormatterOutput(output)).toMatchSnapshot();
};

describe('TAP Formatting Tests', () => {
  const failures = new Set([1, 5, 8, 12]);

  it('should format test results', () => {
    expectSnapshot(formatTap(testResults));
  });

  it('should format test results and epilog', () => {
    expectSnapshot(formatTap(testResults, ['One', 'Two', 'Three']));
  });

  it('should report the correct number of test points', async () => {
    const result = buildTapResults(testResults);
    expect(result).not.toHaveLength(0);
    expect(result).toHaveLength(16);
  });

  it('should report test outcome', () => {
    const result = buildTapResults(testResults);
    result.forEach((r, i) => {
      expect(r.testNumber).toBe(i + 1);
      if (failures.has(i)) {
        expect(r.outcome).toBe('not ok');
        expect(r.diagnostics.length).toBeGreaterThan(0);
      } else {
        expect(r.outcome).toBe('ok');
        expect(r.diagnostics).toEqual([]);
      }
    });
  });

  it('should report test diagnostics', () => {
    const result = buildTapResults(testResults);
    expect(result[1].diagnostics).toEqual(['Unknown error']);
    expect(result[5].diagnostics).toEqual([
      'System.AssertException: Assertion Failed: Should not have found an animal: Expected: FooBar, Actual:',
      'Class.AnimalLocatorTest.testMissingAnimal: line 22, column 1'
    ]);
    expect(result[8].diagnostics).toEqual([
      'System.AssertException: Assertion Failed: Incorrect count: Expected: 3, Actual: 2',
      'Class.AccountProcessorTest.testCountContacts: line 47, column 1'
    ]);
    expect(result[12].diagnostics).toEqual(['Weird characters <>&"\'', 'Surrounded by newlines.', 'and whitespace.']);
  });
});
