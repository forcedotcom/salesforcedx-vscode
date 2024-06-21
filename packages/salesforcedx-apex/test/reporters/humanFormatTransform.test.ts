/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { HumanFormatTransform } from './../../src/reporters/humanFormatTransform';
import { expect } from 'chai';
import { pipeline, Writable } from 'node:stream';
import {
  testResults,
  successResult,
  coverageResult,
  coverageFailResult
} from './testResults';
import { fail } from 'assert';

describe('HumanFormatTransform', () => {
  const createWritableAndPipeline = (
    reporter: HumanFormatTransform,
    callback: (result: string) => void
  ): void => {
    let result = '';

    const writable = new Writable({
      write(chunk, encoding, done) {
        result += chunk;
        done();
      }
    });

    writable.on('finish', () => callback(result));

    pipeline(reporter, writable, (err) => {
      if (err) {
        console.error('Pipeline failed', err);
        fail(err);
      }
    });
  };

  it('should format test results with failures', () => {
    const reporter = new HumanFormatTransform(testResults, false);
    createWritableAndPipeline(reporter, (result) => {
      expect(result).to.not.be.empty;
      expect(result).to.contain(
        'AnimalLocatorTest.testMissingAnimal                  Fail     System.AssertException: Assertion Failed: Should not have found an animal: Expected: FooBar, Actual:'
      );
      expect(result).to.contain(
        'Class.AnimalLocatorTest.testMissingAnimal: line 22, column 1'
      );
      expect(result).to.contain('=== Test Results');
      expect(result).to.contain('=== Test Summary');
    });
  });

  it('should format tests with 0 failures', () => {
    const reporter = new HumanFormatTransform(successResult, false);
    createWritableAndPipeline(reporter, (result) => {
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
  });

  it('should format test results with code coverage', async () => {
    const reporter = new HumanFormatTransform(coverageResult, false);
    createWritableAndPipeline(reporter, (result) => {
      expect(result).to.not.be.empty;
      expect(result).to.contain('=== Apex Code Coverage by Class');
      expect(result).to.contain('ApexTestClass  12.5%    9,10');
      expect(result).to.contain('=== Test Results');
      expect(result).to.contain('=== Test Summary');
    });
  });

  it('should format test results with detailed coverage specified', () => {
    const reporter = new HumanFormatTransform(coverageResult, true);
    createWritableAndPipeline(reporter, (result) => {
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

  it('should format test results with failures with detailed coverage specified', () => {
    const reporter = new HumanFormatTransform(coverageFailResult, true);
    createWritableAndPipeline(reporter, (result) => {
      expect(result).to.not.be.empty;
      expect(result).to.contain('=== Apex Code Coverage by Class');
      expect(result).to.contain('ApexTestClass  12.5%    9,10');
      expect(result).to.not.contain('=== Test Results');
      expect(result).to.contain(
        '=== Apex Code Coverage for Test Run 7073t000061uwZI'
      );
      expect(result).to.contain(
        'AccountServiceTest.should_create_account                      Pass                                                                                                                    86'
      );
      expect(result).to.contain(
        'AnimalLocatorTest.testMissingAnimal                           Fail              System.AssertException: Assertion Failed: Should not have found an animal: Expected: FooBar, Actual'
      );
      expect(result).to.contain(
        'Class.AnimalLocatorTest.testMissingAnimal: line 22, column 1'
      );
      expect(result).to.contain('=== Test Summary');
    });
  });

  it('should format test results and skip successful tests if concise is true', () => {
    const reporter = new HumanFormatTransform(testResults, false, true);
    createWritableAndPipeline(reporter, (result) => {
      expect(result).to.not.be.empty;
      expect(result).to.not.contain(
        'AccountServiceTest.should_create_account             Pass                                                                                                           86'
      );
      expect(result).to.contain('AwesomeCalculatorTest.testCallout       Fail');
      expect(result).to.contain('=== Test Results');
      expect(result).to.contain('=== Test Summary');
    });
  });

  it('should format test results and not display coverage results if concise is true', () => {
    const reporter = new HumanFormatTransform(coverageFailResult, true, true);
    createWritableAndPipeline(reporter, (result) => {
      expect(result).to.not.be.empty;
      expect(result).to.not.contain('=== Apex Code Coverage by Class');
      expect(result).to.not.contain('ApexTestClass  12.5%    9,10');
      expect(result).to.contain(
        '=== Apex Code Coverage for Test Run 7073t000061uwZI'
      );
      expect(result).to.not.contain(
        'AccountServiceTest.should_create_account             Pass                                                                                                           86'
      );
      expect(result).to.contain(
        'AnimalLocatorTest.testMissingAnimal                      Fail              System.AssertException: Assertion Failed: Should not have found an animal: Expected: FooBar, Actual:'
      );
      expect(result).to.contain('=== Test Summary');
    });
  });
});
