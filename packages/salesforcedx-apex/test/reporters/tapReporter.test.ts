/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TapReporter } from '../../src';
import { testResults } from './testResults';

describe('TAP Reporter Tests', () => {
  let reporter: TapReporter;
  const failures = new Set([1, 5, 8, 12]);

  beforeEach(async () => {
    reporter = new TapReporter();
  });

  it('should format test results', () => {
    const result = reporter.format(testResults);
    expect(result).not.toHaveLength(0);
    expect(result).toContain('1..16');
    expect(result).toContain('ok 1 AccountServiceTest.should_create_account');
    expect(result).toContain(
      'not ok 6 AnimalLocatorTest.testMissingAnimal\n# System.AssertException: Assertion Failed: Should not have found an animal: Expected: FooBar, Actual:\n# Class.AnimalLocatorTest.testMissingAnimal: line 22, column 1\n'
    );
  });

  it('should format test results and epilog', () => {
    const result = reporter.format(testResults, ['One', 'Two', 'Three']);
    expect(result).not.toHaveLength(0);
    expect(result).toContain('1..16');
    expect(result).toContain('ok 1 AccountServiceTest.should_create_account');
    expect(result).toMatch(new RegExp('ok 16 DailyLeadProcessorTest.testLeadProcessing\n# One\n# Two\n# Three\n$'));
  });

  it('should report the correct number of test points', async () => {
    const result = reporter.buildTapResults(testResults);
    expect(result).not.toHaveLength(0);
    expect(result).toHaveLength(16);
  });

  it('should report test outcome', () => {
    const result = reporter.buildTapResults(testResults);
    result.forEach((r, i) => {
      expect(r.testNumber).toBe(i + 1);
      if (failures.has(i)) {
        expect(r.outcome).toBe('not ok');
        expect(r.diagnostics).not.toBeNull();
      } else {
        expect(r.outcome).toBe('ok');
        expect(r.diagnostics).toEqual([]);
      }
    });
  });

  it('should report test diagnostics', () => {
    const result = reporter.buildTapResults(testResults);
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
