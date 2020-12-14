/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { HumanReporter } from '../../src';
import { successResult, testResults, coverageResult } from './testResults';

describe('Human Reporter Tests', () => {
  const reporter = new HumanReporter();

  it('should format test results with failures', () => {
    const result = reporter.format(testResults, false);
    expect(result).to.not.be.empty;
    expect(result).to.contain(
      'AnimalLocatorTest.testMissingAnimal                   Fail     System.AssertException: Assertion Failed: Should not have found an animal: Expected: FooBar, Actual:  5'
    );
    expect(result).to.contain('=== Test Results');
    expect(result).to.contain('=== Test Summary');
  });

  it('should format tests with 0 failures', () => {
    const result = reporter.format(successResult, false);
    expect(result).to.not.be.empty;
    expect(result).to.contain(
      'AccountServiceTest.should_create_account  Pass              86 '
    );
    expect(result).to.contain(
      'AwesomeCalculatorTest.testCallout         Pass              23'
    );
    expect(result).to.contain('=== Test Results');
    expect(result).to.contain('=== Test Summary');
  });

  it('should format test results with code coverage', () => {
    const result = reporter.format(coverageResult, false);
    expect(result).to.not.be.empty;
    expect(result).to.contain('=== Apex Code Coverage by Class');
    expect(result).to.contain('ApexTestClass  12.5%    9,10');
    expect(result).to.contain('=== Test Results');
    expect(result).to.contain('=== Test Summary');
  });

  it('should format test results with detailed coverage specified', () => {
    const result = reporter.format(coverageResult, true);
    expect(result).to.not.be.empty;
    expect(result).to.contain('=== Apex Code Coverage by Class');
    expect(result).to.contain('ApexTestClass  12.5%    9,10');
    expect(result).to.not.contain('=== Test Results');
    expect(result).to.contain(
      '=== Apex Code Coverage for Test Run 7073t000061uwZI'
    );
    expect(result).to.contain(
      'AccountServiceTest.should_create_account                      Pass                       86'
    );
    expect(result).to.contain('=== Test Summary');
  });
});
