/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { HumanReporter } from '../../src';
import {
  successResult,
  testResults,
  coverageResult,
  coverageFailResult,
  setupResult,
  testResultsWithCategory,
  coverageResultWithCategory,
  coverageFailResultWithCategory
} from './testResults';

describe('Human Reporter Tests', () => {
  const reporter = new HumanReporter();

  it('should format test results with failures', () => {
    const result = reporter.format(testResults, false);
    expect(result).not.toHaveLength(0);
    expect(result).toContain(
      'AnimalLocatorTest.testMissingAnimal                  Fail     System.AssertException: Assertion Failed: Should not have found an animal: Expected: FooBar, Actual:'
    );
    expect(result).toContain('Class.AnimalLocatorTest.testMissingAnimal: line 22, column 1');
    expect(result).toContain('=== Test Results');
    expect(result).toContain('=== Test Summary');
  });

  it('should format tests with 0 failures', () => {
    const result = reporter.format(successResult, false);
    expect(result).not.toHaveLength(0);
    expect(result).toContain('AccountServiceTest.should_create_account  Pass              86 ');
    expect(result).toContain('AwesomeCalculatorTest.testCallout         Pass              23');
    expect(result).toContain('=== Test Results');
    expect(result).toContain('=== Test Summary');
  });

  it('should format test results with code coverage', () => {
    const result = reporter.format(coverageResult, false);
    expect(result).not.toHaveLength(0);
    expect(result).toContain('=== Apex Code Coverage by Class');
    expect(result).toContain('ApexTestClass  12.5%    9,10');
    expect(result).toContain('=== Test Results');
    expect(result).toContain('=== Test Summary');
  });

  it('should format test results with setup methods', () => {
    const result = reporter.format(setupResult, false);
    expect(result).not.toHaveLength(0);
    expect(result).toContain('=== Apex Code Coverage by Class');
    expect(result).toContain('=== Test Results');
    expect(result).toContain('=== Test Summary');
    expect(result).toContain('=== Test Setup Time by Test Class for Run 7073t000061uwZI');
    expect(result).toContain('AccountServiceTest.setup_method  24');
    expect(result).toContain('Test Setup Time      24 ms');
    expect(result).toContain('Test Total Time      5487 ms');
  });

  it('should not display test setup summary if class has no setup methods', () => {
    const result = reporter.format(successResult, false);
    expect(result).not.toHaveLength(0);
    expect(result).toContain('=== Test Results');
    expect(result).toContain('=== Test Summary');
    expect(result).not.toContain('=== Test Setup Time by Test Class for Run 7073t000061uwZI');
    expect(result).not.toContain('AccountServiceTest.setup_method  24');
    expect(result).toContain('Test Setup Time      0 ms');
    expect(result).toContain('Test Total Time      5463 ms');
  });

  it('should not display test setup summary if concise is true', () => {
    const result = reporter.format(setupResult, false, true);
    expect(result).not.toHaveLength(0);
    expect(result).not.toContain('=== Test Setup Time by Test Class for Run 7073t000061uwZI');
    expect(result).not.toContain('AccountServiceTest.setup_method  24');
  });

  it('should format test results with detailed coverage specified', () => {
    const result = reporter.format(coverageResult, true);
    expect(result).not.toHaveLength(0);
    expect(result).toContain('=== Apex Code Coverage by Class');
    expect(result).toContain('ApexTestClass  12.5%    9,10');
    expect(result).not.toContain('=== Test Results');
    expect(result).toContain('=== Apex Code Coverage for Test Run 7073t000061uwZI');
    expect(result).toContain(
      'AccountServiceTest.should_create_account                      Pass                       86'
    );
    expect(result).toContain('=== Test Summary');
  });

  it('should format test results with failures with detailed coverage specified', () => {
    const result = reporter.format(coverageFailResult, true);
    expect(result).not.toHaveLength(0);
    expect(result).toContain('=== Apex Code Coverage by Class');
    expect(result).toContain('ApexTestClass  12.5%    9,10');
    expect(result).not.toContain('=== Test Results');
    expect(result).toContain('=== Apex Code Coverage for Test Run 7073t000061uwZI');
    expect(result).toContain(
      'AccountServiceTest.should_create_account                      Pass                                                                                                                    86'
    );
    expect(result).toContain(
      'AnimalLocatorTest.testMissingAnimal                           Fail              System.AssertException: Assertion Failed: Should not have found an animal: Expected: FooBar, Actual'
    );
    expect(result).toContain('Class.AnimalLocatorTest.testMissingAnimal: line 22, column 1');
    expect(result).toContain('=== Test Summary');
  });

  it('should format test results and skip successful tests if concise is true', () => {
    const result = reporter.format(testResults, false, true);
    expect(result).not.toHaveLength(0);
    expect(result).not.toContain(
      'AccountServiceTest.should_create_account             Pass                                                                                                           86'
    );
    expect(result).toContain('AwesomeCalculatorTest.testCallout       Fail');
    expect(result).toContain('=== Test Results');
    expect(result).toContain('=== Test Summary');
  });

  it('should format test results and not display coverage results if concise is true', () => {
    const result = reporter.format(coverageFailResult, true, true);
    expect(result).not.toHaveLength(0);
    expect(result).not.toContain('=== Apex Code Coverage by Class');
    expect(result).not.toContain('ApexTestClass  12.5%    9,10');
    expect(result).toContain('=== Apex Code Coverage for Test Run 7073t000061uwZI');
    expect(result).not.toContain(
      'AccountServiceTest.should_create_account             Pass                                                                                                           86'
    );
    expect(result).toContain(
      'AnimalLocatorTest.testMissingAnimal                      Fail              System.AssertException: Assertion Failed: Should not have found an animal: Expected: FooBar, Actual:'
    );
    expect(result).toContain('=== Test Summary');
  });

  // Tests for showCategory functionality
  it('should show category column when showCategory is true', () => {
    const result = reporter.format(testResultsWithCategory, false, false, true);
    expect(result).not.toHaveLength(0);
    expect(result).toContain('=== Test Results');
    expect(result).toContain('CATEGORY');
    expect(result).toContain('Apex');
    expect(result).toContain('Flow');
    expect(result).toContain('AccountServiceTest.should_create_account');
    expect(result).toContain('AwesomeCalculatorTest.testCallout');
    expect(result).toContain('AnimalLocatorTest.testMissingAnimal');
  });

  it('should not show category column when showCategory is false', () => {
    const result = reporter.format(testResultsWithCategory, false, false, false);
    expect(result).not.toHaveLength(0);
    expect(result).toContain('=== Test Results');
    expect(result).not.toContain('CATEGORY');
    // Should still contain the test names but not the category column
    expect(result).toContain('AccountServiceTest.should_create_account');
    expect(result).toContain('AwesomeCalculatorTest.testCallout');
    expect(result).toContain('AnimalLocatorTest.testMissingAnimal');
  });

  it('should show category column in detailed coverage when showCategory is true', () => {
    const result = reporter.format(coverageResultWithCategory, true, false, true);
    expect(result).not.toHaveLength(0);
    expect(result).toContain('=== Apex Code Coverage for Test Run 7073t000061uwZI');
    expect(result).toContain('CATEGORY');
    expect(result).toContain('Apex');
    expect(result).toContain('Flow');
    expect(result).toContain('AccountService');
    expect(result).toContain('CalculatorUtils');
  });

  it('should not show category column in detailed coverage when showCategory is false', () => {
    const result = reporter.format(coverageResultWithCategory, true, false, false);
    expect(result).not.toHaveLength(0);
    expect(result).toContain('=== Apex Code Coverage for Test Run 7073t000061uwZI');
    expect(result).not.toContain('CATEGORY');
    // Should still contain the covered class names
    expect(result).toContain('AccountService');
    expect(result).toContain('CalculatorUtils');
  });

  it('should show category column with concise mode when showCategory is true', () => {
    const result = reporter.format(testResultsWithCategory, false, true, true);
    expect(result).not.toHaveLength(0);
    expect(result).toContain('=== Test Results');
    expect(result).toContain('CATEGORY');
  });

  it('should show category column in detailed coverage with concise mode when showCategory is true', () => {
    const result = reporter.format(coverageFailResultWithCategory, true, true, true);
    expect(result).not.toHaveLength(0);
    expect(result).toContain('=== Apex Code Coverage for Test Run 7073t000061uwZI');
    expect(result).toContain('CATEGORY');
    expect(result).not.toContain('=== Apex Code Coverage by Class');
  });
});
