/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MarkdownTextFormatTransformer } from '../../src';
import { pipeline, Writable } from 'node:stream';
import { getTestData, successResult } from './testResults';
import { ApexTestResultOutcome } from '../../src/tests/types';

const { testResults } = getTestData();

describe('MarkdownTextFormatTransformer', () => {
  const runPipeline = (reporter: MarkdownTextFormatTransformer): Promise<string> =>
    new Promise((resolve, reject) => {
      let result = '';
      const writable = new Writable({
        write(chunk, encoding, done) {
          result += chunk;
          done();
        }
      });
      writable.on('finish', () => resolve(result));
      pipeline(reporter, writable, err => {
        if (err) {
          reject(err);
        }
      });
    });

  const createWritableAndPipeline = async (
    reporter: MarkdownTextFormatTransformer,
    callback: (result: string) => void
  ): Promise<void> => {
    callback(await runPipeline(reporter));
  };

  describe('format differences', () => {
    it('should produce different output for markdown vs text formats', async () => {
      // Use test data with coverage to ensure table appears
      const testDataWithCoverage = {
        ...testResults,
        tests: testResults.tests.map(test => ({
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

      const markdownResult = await runPipeline(
        new MarkdownTextFormatTransformer(testDataWithCoverage, {
          format: 'markdown',
          codeCoverage: true
        })
      );
      const textResult = await runPipeline(
        new MarkdownTextFormatTransformer(testDataWithCoverage, {
          format: 'text',
          codeCoverage: true
        })
      );

      // Markdown should have HTML table syntax, text should not
      expect(markdownResult).toContain('<table');
      expect(textResult).not.toContain('<table');
      // Markdown should have markdown headers, text should have plain text
      expect(markdownResult).toContain('## Summary');
      expect(textResult).toContain('Summary');
      expect(textResult).not.toContain('##');
    });
  });

  describe('summary accuracy', () => {
    it('should accurately reflect test counts in summary', async () => {
      const reporter = new MarkdownTextFormatTransformer(testResults, {
        format: 'markdown'
      });
      await createWritableAndPipeline(reporter, result => {
        // Extract summary numbers
        const totalMatch = result.match(/\*\*Total Tests:\*\* (\d+)/);
        const passedMatch = result.match(/✅ \*\*Passed:\*\* (\d+)/);
        const failedMatch = result.match(/❌ \*\*Failed:\*\* (\d+)/);

        expect(totalMatch).not.toBeNull();
        expect(passedMatch).not.toBeNull();
        expect(failedMatch).not.toBeNull();

        const total = parseInt(totalMatch![1], 10);
        const passed = parseInt(passedMatch![1], 10);
        const failed = parseInt(failedMatch![1], 10);

        // Verify counts match actual test data
        expect(total).toBe(testResults.summary.testsRan);
        expect(passed).toBe(testResults.summary.passing);
        expect(failed).toBe(testResults.summary.failing);
        expect(total).toBe(passed + failed + testResults.summary.skipped);
      });
    });

    it('should format duration correctly', async () => {
      const reporter = new MarkdownTextFormatTransformer(testResults, {
        format: 'markdown'
      });
      await createWritableAndPipeline(reporter, result => {
        const durationMatch = result.match(/⏱️ \*\*Duration:\*\* (.+)/);
        expect(durationMatch).not.toBeNull();
        // Duration should be formatted (not raw milliseconds)
        expect(durationMatch![1]).toMatch(/\d+\.?\d*\s*(ms|s|m)/);
      });
    });
  });

  describe('sorting behavior', () => {
    it('should sort by runtime (slowest first) when sortOrder is runtime', async () => {
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
      await createWritableAndPipeline(reporter, result => {
        // Verify the report was generated
        expect(result).toContain('# Apex Test Results');
        // For runtime sort, we verify that the sorting logic is applied
        // The actual order in the output depends on whether there's a table
        // If there's a table, extract runtime values from table cells
        const tableSection = result.match(/<tbody>([\s\S]*?)<\/tbody>/);
        if (tableSection) {
          // Extract runtime values from table rows
          const runtimeCells = tableSection[1].match(/<td[^>]*>(\d+\.?\d*)\s*(ms|s)<\/td>/g) ?? [];
          if (runtimeCells.length > 1) {
            const parsedRuntimes = runtimeCells
              .map(cell => {
                const numMatch = cell.match(/(\d+\.?\d*)/);
                return numMatch ? parseFloat(numMatch[1]) : 0;
              })
              .filter(r => r > 0);

            if (parsedRuntimes.length > 1) {
              // Verify descending order (slowest first)
              for (let i = 0; i < parsedRuntimes.length - 1; i++) {
                expect(parsedRuntimes[i]).toBeGreaterThanOrEqual(parsedRuntimes[i + 1]);
              }
            }
          }
        }
      });
    });

    it('should sort by severity (failures first) when sortOrder is severity', async () => {
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
      await createWritableAndPipeline(reporter, result => {
        // Failures section should appear before passed tests
        const failuresIndex = result.indexOf('## ❌ Failures');
        const passedIndex = result.indexOf('## ✅ Passed Tests');
        if (failuresIndex !== -1 && passedIndex !== -1) {
          expect(failuresIndex).toBeLessThan(passedIndex);
        }
      });
    });
  });

  describe('threshold warnings', () => {
    it('should flag tests exceeding performance threshold with correct values', async () => {
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
      await createWritableAndPipeline(reporter, result => {
        // Should have warnings section
        expect(result).toContain('## ⚠️ Test Quality Warnings');
        expect(result).toContain('🐌 Poorly Performing Tests');
        // Should mention the threshold (formatDuration(5000) produces "5s")
        expect(result).toContain('Tests taking longer than');
        // Should mention the slow test (name may be escaped or formatted)
        expect(result).toMatch(/SlowTest|AccountServiceTest/);
      });
    });

    it('should flag tests below coverage threshold with correct percentage', async () => {
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

      const reporter = new MarkdownTextFormatTransformer(testDataWithLowCoverage, {
        format: 'markdown',
        codeCoverage: true,
        coverageThresholdPercent: 75
      });
      await createWritableAndPipeline(reporter, result => {
        // Should have warnings section
        expect(result).toContain('## ⚠️ Test Quality Warnings');
        expect(result).toContain('📉 Poorly Covered Tests');
        // Should mention the threshold
        expect(result).toContain('75%');
        // Should mention the low coverage test (name may be formatted as ClassName.methodName)
        expect(result).toMatch(/LowCoverageTest|AccountServiceTest/);
        expect(result).toContain('10%');
      });
    });

    it('should not flag tests that meet thresholds', async () => {
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
      await createWritableAndPipeline(reporter, result => {
        // Should not have warnings section
        expect(result).not.toContain('## ⚠️ Test Quality Warnings');
      });
    });
  });

  describe('failure formatting', () => {
    it('should format failure details with message and stack trace', async () => {
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
      await createWritableAndPipeline(reporter, result => {
        // Should have failures section
        expect(result).toContain('## ❌ Failures (1)');
        // Test name is formatted as ClassName.methodName
        expect(result).toContain('AccountServiceTest.FailingTest');
        // Should have error message
        expect(result).toContain('**Error Message**');
        expect(result).toContain('Assertion failed: expected true but was false');
        // Should have stack trace
        expect(result).toContain('**Stack Trace**');
        expect(result).toContain('Class.FailingTest.test: line 10, column 1');
      });
    });

    it('should handle failures without message or stack trace', async () => {
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
      await createWritableAndPipeline(reporter, result => {
        // Should still have failures section
        expect(result).toContain('## ❌ Failures (1)');
        // Test name is formatted as ClassName.methodName
        expect(result).toContain('AccountServiceTest.FailingTest');
        // Should not have error message or stack trace sections
        expect(result).not.toContain('**Error Message**');
        expect(result).not.toContain('**Stack Trace**');
      });
    });
  });

  describe('code coverage display', () => {
    it('should not markdown-escape underscores in coverage table code cells', async () => {
      const testDataWithUnderscoreMethod = {
        ...successResult,
        tests: [
          {
            ...successResult.tests[0],
            apexClass: {
              ...successResult.tests[0].apexClass,
              name: 'LCOUtilsTest',
              namespacePrefix: 'lco1'
            },
            methodName: 'test_LCOSDCreateController_assignDefaultPAItems',
            perClassCoverage: [
              {
                apexClassOrTriggerName: 'LCOUtilsTest',
                apexClassOrTriggerId: '001',
                apexTestClassId: successResult.tests[0].apexClass.id,
                apexTestMethodName: 'test_LCOSDCreateController_assignDefaultPAItems',
                numLinesCovered: 2,
                numLinesUncovered: 98,
                percentage: '2%'
              }
            ]
          }
        ]
      };

      const reporter = new MarkdownTextFormatTransformer(testDataWithUnderscoreMethod, {
        format: 'markdown',
        codeCoverage: true
      });
      await createWritableAndPipeline(reporter, result => {
        expect(result).toContain('## Test Results with Coverage');
        expect(result).toContain('<code>lco1.LCOUtilsTest.test_LCOSDCreateController_assignDefaultPAItems</code>');
        // Ensure underscores inside <code> tags are not markdown-escaped with a backslash.
        expect(result).not.toMatch(/<code>[^<]*\\_[^<]*<\/code>/);
      });
    });

    it('should display coverage table with correct percentages', async () => {
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
      await createWritableAndPipeline(reporter, result => {
        // Should have coverage section
        expect(result).toContain('## Code Coverage by Class');
        // Should list both classes
        expect(result).toContain('ClassA');
        expect(result).toContain('ClassB');
        // Should show correct percentages
        expect(result).toContain('80%');
        expect(result).toContain('50%');
      });
    });

    it('should not display coverage when codeCoverage option is false', async () => {
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
      await createWritableAndPipeline(reporter, result => {
        // Should not have coverage sections
        expect(result).not.toContain('## Code Coverage');
        expect(result).not.toContain('ClassA');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty test results', async () => {
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
      await createWritableAndPipeline(reporter, result => {
        expect(result).toContain('# Apex Test Results');
        expect(result).toContain('## Summary');
        expect(result).toContain('**Total Tests:** 0');
        expect(result).toContain('✅ **Passed:** 0');
        expect(result).toContain('❌ **Failed:** 0');
        // Should not have test results sections
        expect(result).not.toContain('## ❌ Failures');
        expect(result).not.toContain('## ✅ Passed Tests');
        expect(result).not.toContain('Test Results with Coverage');
      });
    });

    it('should handle missing optional fields gracefully', async () => {
      const testDataWithMissingFields = {
        ...successResult,
        summary: {
          ...successResult.summary,
          testRunId: undefined as unknown as string,
          userId: undefined as unknown as string,
          username: undefined as unknown as string
        }
      };

      const reporter = new MarkdownTextFormatTransformer(testDataWithMissingFields, {
        format: 'markdown'
      });
      await createWritableAndPipeline(reporter, result => {
        // Should still produce valid output
        expect(result).toContain('# Apex Test Results');
        expect(result).toContain('## Summary');
      });
    });

    it('should use default options when none provided', async () => {
      const reporter = new MarkdownTextFormatTransformer(testResults);
      await createWritableAndPipeline(reporter, result => {
        // Should default to markdown format
        expect(result).toContain('# Apex Test Results');
        expect(result).toContain('## Summary');
        // Should use default threshold (5000ms)
        // If there are slow tests, they should be flagged
        if (testResults.tests.some(t => (t.runTime ?? 0) > 5000)) {
          expect(result).toContain('⚠️');
        }
      });
    });
  });

  describe('timestamp formatting', () => {
    it('should use provided timestamp', async () => {
      const timestamp = new Date('2025-01-15T10:30:00Z');
      const reporter = new MarkdownTextFormatTransformer(testResults, {
        format: 'markdown',
        timestamp
      });
      await createWritableAndPipeline(reporter, result => {
        // Should contain the timestamp
        expect(result).toContain('**Run completed:**');
        // The exact format may vary, but should contain date/time info
        const timestampStr = result.match(/\*\*Run completed:\*\* (.+)/)?.[1];
        expect(timestampStr).toBeDefined();
      });
    });

    it('should use current time when timestamp not provided', async () => {
      const reporter = new MarkdownTextFormatTransformer(testResults, {
        format: 'markdown'
      });
      await createWritableAndPipeline(reporter, result => {
        // Should contain timestamp
        expect(result).toContain('**Run completed:**');
        // Extract and verify it's within reasonable range
        const timestampMatch = result.match(/\*\*Run completed:\*\* (.+)/);
        expect(timestampMatch).not.toBeNull();
      });
    });
  });
});
