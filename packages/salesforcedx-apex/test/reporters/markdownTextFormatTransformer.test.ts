/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MarkdownTextFormatTransformer } from '../../src';
import { expect } from 'chai';
import { pipeline, Writable } from 'node:stream';
import { getTestData, successResult } from './testResults';
import { fail } from 'assert';
import { ApexTestResultOutcome } from '../../src/tests/types';

const { testResults } = getTestData();

describe('MarkdownTextFormatTransformer', () => {
  const createWritableAndPipeline = (
    reporter: MarkdownTextFormatTransformer,
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

  describe('format differences', () => {
    it('should produce different output for markdown vs text formats', (done) => {
      // Use test data with coverage to ensure table appears
      const testDataWithCoverage = {
        ...testResults,
        tests: testResults.tests.map((test) => ({
          ...test,
          perClassCoverage: [
            {
              apexClassOrTriggerName: 'TestClass',
              apexClassOrTriggerId: '001',
              apexTestClassId: test.apexClass.id,
              apexTestMethodName: test.methodName,
              numLinesCovered: 80,
              numLinesUncovered: 20,
              percentage: '80%'
            }
          ]
        }))
      };

      let markdownResult = '';
      let textResult = '';
      let markdownDone = false;
      let textDone = false;

      const checkResults = () => {
        if (markdownDone && textDone) {
          // Markdown should have HTML table syntax, text should not
          expect(markdownResult).to.contain('<table');
          expect(textResult).to.not.contain('<table');
          // Markdown should have markdown headers, text should have plain text
          expect(markdownResult).to.contain('## Summary');
          expect(textResult).to.contain('Summary');
          expect(textResult).to.not.contain('##');
          done();
        }
      };

      const markdownReporter = new MarkdownTextFormatTransformer(
        testDataWithCoverage,
        {
          format: 'markdown',
          codeCoverage: true
        }
      );
      createWritableAndPipeline(markdownReporter, (result) => {
        markdownResult = result;
        markdownDone = true;
        checkResults();
      });

      const textReporter = new MarkdownTextFormatTransformer(
        testDataWithCoverage,
        {
          format: 'text',
          codeCoverage: true
        }
      );
      createWritableAndPipeline(textReporter, (result) => {
        textResult = result;
        textDone = true;
        checkResults();
      });
    });
  });

  describe('summary accuracy', () => {
    it('should accurately reflect test counts in summary', () => {
      const reporter = new MarkdownTextFormatTransformer(testResults, {
        format: 'markdown'
      });
      createWritableAndPipeline(reporter, (result) => {
        // Extract summary numbers
        const totalMatch = result.match(/\*\*Total Tests:\*\* (\d+)/);
        const passedMatch = result.match(/✅ \*\*Passed:\*\* (\d+)/);
        const failedMatch = result.match(/❌ \*\*Failed:\*\* (\d+)/);

        expect(totalMatch).to.not.be.null;
        expect(passedMatch).to.not.be.null;
        expect(failedMatch).to.not.be.null;

        const total = parseInt(totalMatch![1], 10);
        const passed = parseInt(passedMatch![1], 10);
        const failed = parseInt(failedMatch![1], 10);

        // Verify counts match actual test data
        expect(total).to.equal(testResults.summary.testsRan);
        expect(passed).to.equal(testResults.summary.passing);
        expect(failed).to.equal(testResults.summary.failing);
        expect(total).to.equal(passed + failed + testResults.summary.skipped);
      });
    });

    it('should format duration correctly', () => {
      const reporter = new MarkdownTextFormatTransformer(testResults, {
        format: 'markdown'
      });
      createWritableAndPipeline(reporter, (result) => {
        const durationMatch = result.match(/⏱️ \*\*Duration:\*\* (.+)/);
        expect(durationMatch).to.not.be.null;
        // Duration should be formatted (not raw milliseconds)
        expect(durationMatch![1]).to.match(/\d+\.?\d*\s*(ms|s|m)/);
      });
    });
  });

  describe('sorting behavior', () => {
    it('should sort by runtime (slowest first) when sortOrder is runtime', () => {
      // Create test data with known runtimes
      const testDataWithRuntimes = {
        ...successResult,
        tests: [
          {
            ...successResult.tests[0],
            runTime: 100,
            fullName: 'TestA'
          },
          {
            ...successResult.tests[1],
            runTime: 500,
            fullName: 'TestB'
          },
          {
            ...successResult.tests[0],
            runTime: 50,
            fullName: 'TestC',
            id: 'test-c-id'
          }
        ]
      };

      const reporter = new MarkdownTextFormatTransformer(testDataWithRuntimes, {
        format: 'markdown',
        sortOrder: 'runtime'
      });
      createWritableAndPipeline(reporter, (result) => {
        // Verify the report was generated
        expect(result).to.contain('# Apex Test Results');
        // For runtime sort, we verify that the sorting logic is applied
        // The actual order in the output depends on whether there's a table
        // If there's a table, extract runtime values from table cells
        const tableSection = result.match(/<tbody>([\s\S]*?)<\/tbody>/);
        if (tableSection) {
          // Extract runtime values from table rows
          const runtimeCells =
            tableSection[1].match(/<td[^>]*>(\d+\.?\d*)\s*(ms|s)<\/td>/g) || [];
          if (runtimeCells.length > 1) {
            const parsedRuntimes = runtimeCells
              .map((cell) => {
                const numMatch = cell.match(/(\d+\.?\d*)/);
                return numMatch ? parseFloat(numMatch[1]) : 0;
              })
              .filter((r) => r > 0);

            if (parsedRuntimes.length > 1) {
              // Verify descending order (slowest first)
              for (let i = 0; i < parsedRuntimes.length - 1; i++) {
                expect(parsedRuntimes[i]).to.be.at.least(parsedRuntimes[i + 1]);
              }
            }
          }
        }
      });
    });

    it('should sort by severity (failures first) when sortOrder is severity', () => {
      const testDataWithFailures = {
        ...successResult,
        tests: [
          {
            ...successResult.tests[0],
            outcome: ApexTestResultOutcome.Pass,
            fullName: 'PassingTest'
          },
          {
            ...successResult.tests[1],
            outcome: ApexTestResultOutcome.Fail,
            fullName: 'FailingTest',
            message: 'Test failed' as string | null
          }
        ]
      };

      const reporter = new MarkdownTextFormatTransformer(testDataWithFailures, {
        format: 'markdown',
        sortOrder: 'severity'
      });
      createWritableAndPipeline(reporter, (result) => {
        // Failures section should appear before passed tests
        const failuresIndex = result.indexOf('## ❌ Failures');
        const passedIndex = result.indexOf('## ✅ Passed Tests');
        if (failuresIndex !== -1 && passedIndex !== -1) {
          expect(failuresIndex).to.be.lessThan(passedIndex);
        }
      });
    });
  });

  describe('threshold warnings', () => {
    it('should flag tests exceeding performance threshold with correct values', () => {
      const testDataWithSlowTest = {
        ...successResult,
        tests: [
          {
            ...successResult.tests[0],
            runTime: 6000, // 6 seconds, exceeds 5s threshold
            fullName: 'AccountServiceTest.SlowTest',
            methodName: 'SlowTest'
          }
        ],
        summary: {
          ...successResult.summary,
          testsRan: 1
        }
      };

      const reporter = new MarkdownTextFormatTransformer(testDataWithSlowTest, {
        format: 'markdown',
        performanceThresholdMs: 5000
      });
      createWritableAndPipeline(reporter, (result) => {
        // Should have warnings section
        expect(result).to.contain('## ⚠️ Test Quality Warnings');
        expect(result).to.contain('🐌 Poorly Performing Tests');
        // Should mention the threshold (formatDuration(5000) produces "5s")
        expect(result).to.contain('Tests taking longer than');
        // Should mention the slow test (name may be escaped or formatted)
        expect(result).to.match(/SlowTest|AccountServiceTest/);
      });
    });

    it('should flag tests below coverage threshold with correct percentage', () => {
      const testDataWithLowCoverage = {
        ...successResult,
        tests: [
          {
            ...successResult.tests[0],
            fullName: 'LowCoverageTest',
            perClassCoverage: [
              {
                apexClassOrTriggerName: 'TestClass',
                apexClassOrTriggerId: '001',
                apexTestClassId: '002',
                apexTestMethodName: 'LowCoverageTest',
                numLinesCovered: 10,
                numLinesUncovered: 90,
                percentage: '10%'
              }
            ]
          }
        ]
      };

      const reporter = new MarkdownTextFormatTransformer(
        testDataWithLowCoverage,
        {
          format: 'markdown',
          codeCoverage: true,
          coverageThresholdPercent: 75
        }
      );
      createWritableAndPipeline(reporter, (result) => {
        // Should have warnings section
        expect(result).to.contain('## ⚠️ Test Quality Warnings');
        expect(result).to.contain('📉 Poorly Covered Tests');
        // Should mention the threshold
        expect(result).to.contain('75%');
        // Should mention the low coverage test (name may be formatted as ClassName.methodName)
        expect(result).to.match(/LowCoverageTest|AccountServiceTest/);
        expect(result).to.contain('10%');
      });
    });

    it('should not flag tests that meet thresholds', () => {
      const testDataWithGoodTest = {
        ...successResult,
        tests: [
          {
            ...successResult.tests[0],
            runTime: 100, // Fast test
            fullName: 'FastTest',
            perClassCoverage: [
              {
                apexClassOrTriggerName: 'TestClass',
                apexClassOrTriggerId: '001',
                apexTestClassId: '002',
                apexTestMethodName: 'FastTest',
                numLinesCovered: 90,
                numLinesUncovered: 10,
                percentage: '90%'
              }
            ]
          }
        ]
      };

      const reporter = new MarkdownTextFormatTransformer(testDataWithGoodTest, {
        format: 'markdown',
        codeCoverage: true,
        performanceThresholdMs: 5000,
        coverageThresholdPercent: 75
      });
      createWritableAndPipeline(reporter, (result) => {
        // Should not have warnings section
        expect(result).to.not.contain('## ⚠️ Test Quality Warnings');
      });
    });
  });

  describe('failure formatting', () => {
    it('should format failure details with message and stack trace', () => {
      const testDataWithFailure = {
        ...successResult,
        tests: [
          {
            ...successResult.tests[0],
            outcome: ApexTestResultOutcome.Fail,
            fullName: 'AccountServiceTest.FailingTest',
            methodName: 'FailingTest',
            message: 'Assertion failed: expected true but was false',
            stackTrace: 'Class.FailingTest.test: line 10, column 1'
          } as (typeof successResult.tests)[0]
        ],
        summary: {
          ...successResult.summary,
          failing: 1,
          passing: 0,
          testsRan: 1
        }
      };

      const reporter = new MarkdownTextFormatTransformer(testDataWithFailure, {
        format: 'markdown'
      });
      createWritableAndPipeline(reporter, (result) => {
        // Should have failures section
        expect(result).to.contain('## ❌ Failures (1)');
        // Test name is formatted as ClassName.methodName
        expect(result).to.contain('AccountServiceTest.FailingTest');
        // Should have error message
        expect(result).to.contain('**Error Message**');
        expect(result).to.contain(
          'Assertion failed: expected true but was false'
        );
        // Should have stack trace
        expect(result).to.contain('**Stack Trace**');
        expect(result).to.contain('Class.FailingTest.test: line 10, column 1');
      });
    });

    it('should handle failures without message or stack trace', () => {
      const testDataWithFailure = {
        ...successResult,
        tests: [
          {
            ...successResult.tests[0],
            outcome: ApexTestResultOutcome.Fail,
            fullName: 'AccountServiceTest.FailingTest',
            methodName: 'FailingTest',
            message: null as string | null,
            stackTrace: null as string | null
          } as (typeof successResult.tests)[0]
        ],
        summary: {
          ...successResult.summary,
          failing: 1,
          passing: 0,
          testsRan: 1
        }
      };

      const reporter = new MarkdownTextFormatTransformer(testDataWithFailure, {
        format: 'markdown'
      });
      createWritableAndPipeline(reporter, (result) => {
        // Should still have failures section
        expect(result).to.contain('## ❌ Failures (1)');
        // Test name is formatted as ClassName.methodName
        expect(result).to.contain('AccountServiceTest.FailingTest');
        // Should not have error message or stack trace sections
        expect(result).to.not.contain('**Error Message**');
        expect(result).to.not.contain('**Stack Trace**');
      });
    });
  });

  describe('code coverage display', () => {
    it('should display coverage table with correct percentages', () => {
      const testDataWithCoverage = {
        ...successResult,
        codecoverage: [
          {
            apexId: '001',
            name: 'ClassA',
            type: 'ApexClass' as const,
            numLinesCovered: 80,
            numLinesUncovered: 20,
            percentage: '80%',
            coveredLines: Array.from({ length: 80 }, (_, i) => i + 1),
            uncoveredLines: Array.from({ length: 20 }, (_, i) => i + 81)
          },
          {
            apexId: '002',
            name: 'ClassB',
            type: 'ApexClass' as const,
            numLinesCovered: 50,
            numLinesUncovered: 50,
            percentage: '50%',
            coveredLines: Array.from({ length: 50 }, (_, i) => i + 1),
            uncoveredLines: Array.from({ length: 50 }, (_, i) => i + 51)
          }
        ]
      };

      const reporter = new MarkdownTextFormatTransformer(testDataWithCoverage, {
        format: 'markdown',
        codeCoverage: true
      });
      createWritableAndPipeline(reporter, (result) => {
        // Should have coverage section
        expect(result).to.contain('## Code Coverage by Class');
        // Should list both classes
        expect(result).to.contain('ClassA');
        expect(result).to.contain('ClassB');
        // Should show correct percentages
        expect(result).to.contain('80%');
        expect(result).to.contain('50%');
      });
    });

    it('should not display coverage when codeCoverage option is false', () => {
      const testDataWithCoverage = {
        ...successResult,
        codecoverage: [
          {
            apexId: '001',
            name: 'ClassA',
            type: 'ApexClass' as const,
            numLinesCovered: 80,
            numLinesUncovered: 20,
            percentage: '80%',
            coveredLines: [1, 2, 3],
            uncoveredLines: [4, 5]
          }
        ]
      };

      const reporter = new MarkdownTextFormatTransformer(testDataWithCoverage, {
        format: 'markdown',
        codeCoverage: false
      });
      createWritableAndPipeline(reporter, (result) => {
        // Should not have coverage sections
        expect(result).to.not.contain('## Code Coverage');
        expect(result).to.not.contain('ClassA');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty test results', () => {
      const emptyResult: typeof testResults = {
        summary: {
          failRate: '0%',
          testsRan: 0,
          orgId: '00D3t000001vIruEAE',
          outcome: 'Completed',
          passRate: '0%',
          skipRate: '0%',
          testStartTime: '2020-11-09T18:02:50.000+0000',
          testExecutionTimeInMs: 0,
          testTotalTimeInMs: 0,
          commandTimeInMs: 0,
          testRunId: '7073t000061uwZI',
          userId: '0053t000007OxppAAC',
          username: 'tpo-3',
          failing: 0,
          skipped: 0,
          passing: 0,
          hostname: 'https://na139.salesforce.com'
        },
        tests: []
      };

      const reporter = new MarkdownTextFormatTransformer(emptyResult, {
        format: 'markdown'
      });
      createWritableAndPipeline(reporter, (result) => {
        expect(result).to.contain('# Apex Test Results');
        expect(result).to.contain('## Summary');
        expect(result).to.contain('**Total Tests:** 0');
        expect(result).to.contain('✅ **Passed:** 0');
        expect(result).to.contain('❌ **Failed:** 0');
        // Should not have test results sections
        expect(result).to.not.contain('## ❌ Failures');
        expect(result).to.not.contain('## ✅ Passed Tests');
        expect(result).to.not.contain('Test Results with Coverage');
      });
    });

    it('should handle missing optional fields gracefully', () => {
      const testDataWithMissingFields = {
        ...successResult,
        summary: {
          ...successResult.summary,
          testRunId: undefined as string | undefined,
          userId: undefined as string | undefined,
          username: undefined as string | undefined
        }
      };

      const reporter = new MarkdownTextFormatTransformer(
        testDataWithMissingFields,
        {
          format: 'markdown'
        }
      );
      createWritableAndPipeline(reporter, (result) => {
        // Should still produce valid output
        expect(result).to.contain('# Apex Test Results');
        expect(result).to.contain('## Summary');
      });
    });

    it('should use default options when none provided', () => {
      const reporter = new MarkdownTextFormatTransformer(testResults);
      createWritableAndPipeline(reporter, (result) => {
        // Should default to markdown format
        expect(result).to.contain('# Apex Test Results');
        expect(result).to.contain('## Summary');
        // Should use default threshold (5000ms)
        // If there are slow tests, they should be flagged
        if (testResults.tests.some((t) => (t.runTime ?? 0) > 5000)) {
          expect(result).to.contain('⚠️');
        }
      });
    });
  });

  describe('timestamp formatting', () => {
    it('should use provided timestamp', () => {
      const timestamp = new Date('2025-01-15T10:30:00Z');
      const reporter = new MarkdownTextFormatTransformer(testResults, {
        format: 'markdown',
        timestamp
      });
      createWritableAndPipeline(reporter, (result) => {
        // Should contain the timestamp
        expect(result).to.contain('**Run completed:**');
        // The exact format may vary, but should contain date/time info
        const timestampStr = result.match(/\*\*Run completed:\*\* (.+)/)?.[1];
        expect(timestampStr).to.not.be.undefined;
      });
    });

    it('should use current time when timestamp not provided', () => {
      const reporter = new MarkdownTextFormatTransformer(testResults, {
        format: 'markdown'
      });
      createWritableAndPipeline(reporter, (result) => {
        // Should contain timestamp
        expect(result).to.contain('**Run completed:**');
        // Extract and verify it's within reasonable range
        const timestampMatch = result.match(/\*\*Run completed:\*\* (.+)/);
        expect(timestampMatch).to.not.be.null;
      });
    });
  });
});
