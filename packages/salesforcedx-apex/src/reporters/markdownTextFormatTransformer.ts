/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TestResult, ApexTestResultData } from '../tests/types';
import { Readable, ReadableOptions } from 'node:stream';
import { Logger } from '@salesforce/core';
import { elapsedTime, HeapMonitor } from '../utils';
import {
  ReportData,
  FailureTest,
  WarningTest,
  TestTableRow,
  CoverageTableRow
} from './markdownReportTemplate';
import {
  escapeMarkdown,
  formatDuration,
  isPoorlyPerforming,
  hasPoorCoverage,
  getCoveragePercentage,
  getTestNameInfo,
  formatTimestamp,
  getSummaryInfo,
  getSeverityScore
} from './markdownTextReporter';

type MarkdownTextFormatTransformerOptions = ReadableOptions & {
  bufferSize?: number;
  format?: 'markdown' | 'text';
  sortOrder?: 'runtime' | 'coverage' | 'severity';
  performanceThresholdMs?: number;
  coverageThresholdPercent?: number;
  codeCoverage?: boolean;
  timestamp?: Date;
};

export class MarkdownTextFormatTransformer extends Readable {
  private readonly logger: Logger;
  private buffer: string;
  private readonly bufferSize: number;
  private readonly testResult: TestResult;
  private readonly outputFormat: 'markdown' | 'text';
  private readonly sortOrder: 'runtime' | 'coverage' | 'severity';
  private readonly performanceThresholdMs: number;
  private readonly coverageThresholdPercent: number;
  private readonly codeCoverage: boolean;
  private readonly timestamp: Date;

  constructor(
    testResult: TestResult,
    options?: MarkdownTextFormatTransformerOptions
  ) {
    super(options);
    this.testResult = testResult;
    this.logger = Logger.childFromRoot('MarkdownTextFormatTransformer');
    this.buffer = '';
    this.bufferSize = options?.bufferSize || 256;
    this.outputFormat = options?.format ?? 'markdown';
    this.sortOrder = options?.sortOrder ?? 'runtime';
    this.performanceThresholdMs = options?.performanceThresholdMs ?? 5000;
    this.coverageThresholdPercent = options?.coverageThresholdPercent ?? 75;
    this.codeCoverage = options?.codeCoverage ?? false;
    this.timestamp = options?.timestamp ?? new Date();
  }

  private pushToBuffer(chunk: string): void {
    this.buffer += chunk;
    if (this.buffer.length >= this.bufferSize) {
      this.push(this.buffer);
      this.buffer = '';
    }
  }

  _read(): void {
    this.logger.trace('starting format');
    HeapMonitor.getInstance().checkHeapSize(
      'MarkdownTextFormatTransformer._read'
    );
    this.format();
    if (this.buffer.length > 0) {
      this.push(this.buffer);
    }
    this.push(null); // Signal the end of the stream
    this.logger.trace('finishing format');
    HeapMonitor.getInstance().checkHeapSize(
      'MarkdownTextFormatTransformer._read'
    );
  }

  @elapsedTime()
  private format(): void {
    if (this.outputFormat === 'markdown') {
      this.formatMarkdown();
    } else {
      this.formatText();
    }
  }

  private formatMarkdown(): void {
    const reportData = this.buildReportData();
    this.renderMarkdown(reportData);
  }

  private formatText(): void {
    const reportData = this.buildReportData();
    this.renderText(reportData);
  }

  private buildReportData(): ReportData {
    const { passed, failed, skipped, total, duration } = getSummaryInfo(
      this.testResult.summary
    );
    const timestampStr = formatTimestamp(this.timestamp);

    // Helper function to sort tests based on sort order
    const sortTests = (tests: ApexTestResultData[]): ApexTestResultData[] => {
      if (!tests) {
        return tests;
      }
      return [...tests].sort((a: ApexTestResultData, b: ApexTestResultData) => {
        const runtimeA = a.runTime ?? 0;
        const runtimeB = b.runTime ?? 0;
        const coverageA = this.codeCoverage
          ? (getCoveragePercentage(a.perClassCoverage?.[0]?.percentage) ?? 100)
          : 100;
        const coverageB = this.codeCoverage
          ? (getCoveragePercentage(b.perClassCoverage?.[0]?.percentage) ?? 100)
          : 100;

        if (this.sortOrder === 'runtime') {
          return runtimeB !== runtimeA
            ? runtimeB - runtimeA
            : coverageA - coverageB;
        } else if (this.sortOrder === 'coverage') {
          return coverageA !== coverageB
            ? coverageA - coverageB
            : runtimeB - runtimeA;
        } else {
          const scoreA = getSeverityScore(
            a,
            this.codeCoverage,
            this.performanceThresholdMs,
            this.coverageThresholdPercent
          );
          const scoreB = getSeverityScore(
            b,
            this.codeCoverage,
            this.performanceThresholdMs,
            this.coverageThresholdPercent
          );
          return scoreB - scoreA;
        }
      });
    };

    // Build data structures using spread operators
    const failedTests =
      this.testResult.tests?.filter(
        (test) => test.outcome?.toString() === 'Fail'
      ) ?? [];
    const passedTests =
      this.testResult.tests?.filter(
        (test) => test.outcome?.toString() === 'Pass'
      ) ?? [];
    const skippedTests =
      this.testResult.tests?.filter(
        (test) => test.outcome?.toString() === 'Skip'
      ) ?? [];

    // Build failures data
    const failures: FailureTest[] = failedTests.map((test) => {
      const { testName } = getTestNameInfo(test);
      return {
        testName: escapeMarkdown(testName),
        ...(test.runTime !== undefined && {
          duration: formatDuration(test.runTime)
        }),
        ...(test.message && { message: test.message }),
        ...(test.stackTrace && { stackTrace: test.stackTrace })
      };
    });

    // Identify poorly performing and poorly covered tests
    const poorlyPerformingTests =
      this.testResult.tests?.filter((test) =>
        isPoorlyPerforming(test.runTime, this.performanceThresholdMs)
      ) ?? [];
    const poorlyCoveredTests = this.codeCoverage
      ? (this.testResult.tests?.filter((test) =>
          hasPoorCoverage(
            test.perClassCoverage?.[0]?.percentage,
            this.coverageThresholdPercent
          )
        ) ?? [])
      : [];

    // Build warnings data
    const poorlyPerformingWarnings: WarningTest[] = [...poorlyPerformingTests]
      .sort((a, b) => (b.runTime ?? 0) - (a.runTime ?? 0))
      .map((test) => {
        const { testName } = getTestNameInfo(test);
        return {
          testName: escapeMarkdown(testName),
          value:
            test.runTime !== undefined ? formatDuration(test.runTime) : 'N/A',
          type: 'performance' as const
        };
      });

    const poorlyCoveredWarnings: WarningTest[] = [...poorlyCoveredTests]
      .sort((a, b) => {
        const coverageA =
          getCoveragePercentage(a.perClassCoverage?.[0]?.percentage) ?? 0;
        const coverageB =
          getCoveragePercentage(b.perClassCoverage?.[0]?.percentage) ?? 0;
        return coverageA - coverageB;
      })
      .map((test) => {
        const { testName } = getTestNameInfo(test);
        const coverage = test.perClassCoverage?.[0]?.percentage ?? 'N/A';
        return {
          testName: escapeMarkdown(testName),
          value: typeof coverage === 'string' ? coverage : String(coverage),
          type: 'coverage' as const
        };
      });

    // Build test table data
    const testTableRows: TestTableRow[] =
      this.codeCoverage && this.testResult.tests
        ? sortTests(this.testResult.tests).map((test) => {
            const { fullClassName, testName } = getTestNameInfo(test);
            const outcome = test.outcome?.toString() ?? 'Unknown';
            const coverage = test.perClassCoverage?.[0]?.percentage ?? 'N/A';
            const coverageStr = typeof coverage === 'string' ? coverage : 'N/A';
            const runtime =
              test.runTime !== undefined ? formatDuration(test.runTime) : 'N/A';
            const outcomeEmoji =
              outcome === 'Pass' ? '✅' : outcome === 'Fail' ? '❌' : '⏭️';
            const isSlow = isPoorlyPerforming(
              test.runTime,
              this.performanceThresholdMs
            );
            const hasLowCoverage = hasPoorCoverage(
              coverage,
              this.coverageThresholdPercent
            );

            return {
              testName: escapeMarkdown(testName),
              className: escapeMarkdown(fullClassName),
              outcome,
              outcomeEmoji,
              coverage: coverageStr,
              runtime,
              hasWarning: isSlow || hasLowCoverage
            };
          })
        : [];

    // Build passed tests data
    const passedTestsData = sortTests(passedTests).map((test) => {
      const { testName } = getTestNameInfo(test);
      const isSlow = isPoorlyPerforming(
        test.runTime,
        this.performanceThresholdMs
      );
      const hasLowCoverage =
        this.codeCoverage &&
        hasPoorCoverage(
          test.perClassCoverage?.[0]?.percentage,
          this.coverageThresholdPercent
        );

      return {
        testName: escapeMarkdown(testName),
        ...(test.runTime !== undefined && {
          runtime: formatDuration(test.runTime)
        }),
        ...(this.codeCoverage &&
          test.perClassCoverage?.[0]?.percentage && {
            coverage: String(test.perClassCoverage[0].percentage)
          }),
        isSlow,
        hasLowCoverage
      };
    });

    // Build skipped tests data
    const skippedTestsData = skippedTests.map((test) => {
      const { testName } = getTestNameInfo(test);
      return { testName: escapeMarkdown(testName) };
    });

    // Build coverage table data
    const coverageTableRows: CoverageTableRow[] =
      this.codeCoverage && this.testResult.codecoverage
        ? [...this.testResult.codecoverage]
            .sort((a, b) => {
              const percentageA = getCoveragePercentage(a.percentage) ?? 0;
              const percentageB = getCoveragePercentage(b.percentage) ?? 0;
              return percentageA - percentageB;
            })
            .map((coverageItem) => {
              const className = coverageItem.name ?? 'Unknown';
              const percentage = coverageItem.percentage ?? '0%';
              const uncoveredLines = coverageItem.uncoveredLines ?? [];
              return {
                className: escapeMarkdown(className),
                percentage,
                uncoveredLines:
                  uncoveredLines.length > 0 ? uncoveredLines.join(', ') : 'None'
              };
            })
        : [];

    // Build report data object
    const reportData: ReportData = {
      timestamp: timestampStr,
      summary: {
        total,
        passed,
        failed,
        skipped,
        duration: formatDuration(duration)
      },
      failures,
      warnings: {
        poorlyPerforming: poorlyPerformingWarnings,
        poorlyCovered: poorlyCoveredWarnings
      },
      ...(testTableRows.length > 0 && {
        testTable: {
          rows: testTableRows,
          note: 'Note: Coverage shown is per-test coverage for the class being tested. Overall class coverage is shown in the "Code Coverage by Class" section below.'
        }
      }),
      passedTests: passedTestsData,
      skippedTests: skippedTestsData,
      ...(coverageTableRows.length > 0 && {
        coverageTable: {
          rows: coverageTableRows,
          note: 'This section shows the overall code coverage for each class after all tests have run. This may differ from per-test coverage shown in the table above.'
        }
      })
    };

    return reportData;
  }

  private renderMarkdown(data: ReportData): void {
    this.pushToBuffer('# Apex Test Results\n');
    this.pushToBuffer(`**Run completed:** ${data.timestamp}\n`);
    this.pushToBuffer('\n## Summary\n\n');
    this.pushToBuffer(`- **Total Tests:** ${data.summary.total}\n`);
    this.pushToBuffer(`- ✅ **Passed:** ${data.summary.passed}\n`);
    this.pushToBuffer(`- ❌ **Failed:** ${data.summary.failed}\n`);
    if (data.summary.skipped > 0) {
      this.pushToBuffer(`- ⏭️ **Skipped:** ${data.summary.skipped}\n`);
    }
    this.pushToBuffer(`- ⏱️ **Duration:** ${data.summary.duration}\n\n`);

    // Failures section
    if (data.failures.length > 0) {
      this.pushToBuffer(`## ❌ Failures (${data.failures.length})\n\n`);
      for (const failure of data.failures) {
        this.pushToBuffer(`### ${failure.testName}\n\n`);
        if (failure.duration) {
          this.pushToBuffer(`*Duration: ${failure.duration}*\n\n`);
        }
        if (failure.message) {
          this.pushToBuffer('**Error Message**\n\n');
          this.pushToBuffer('```\n');
          this.pushToBuffer(`${failure.message}\n`);
          this.pushToBuffer('```\n\n');
        }
        if (failure.stackTrace) {
          this.pushToBuffer('**Stack Trace**\n\n');
          this.pushToBuffer('```\n');
          this.pushToBuffer(`${failure.stackTrace}\n`);
          this.pushToBuffer('```\n\n');
        }
        this.pushToBuffer('---\n\n');
      }
    }

    // Warnings section
    const hasWarnings =
      data.warnings.poorlyPerforming.length > 0 ||
      data.warnings.poorlyCovered.length > 0;
    if (hasWarnings) {
      this.pushToBuffer('## ⚠️ Test Quality Warnings\n\n');

      if (data.warnings.poorlyPerforming.length > 0) {
        this.pushToBuffer(
          `### 🐌 Poorly Performing Tests (${data.warnings.poorlyPerforming.length})\n\n`
        );
        this.pushToBuffer(
          `*Tests taking longer than ${formatDuration(this.performanceThresholdMs)} (sorted by runtime, slowest first)*\n\n`
        );
        for (const test of data.warnings.poorlyPerforming) {
          this.pushToBuffer(`- **${test.testName}** - **${test.value}**\n`);
        }
        this.pushToBuffer('\n');
      }

      if (data.warnings.poorlyCovered.length > 0) {
        this.pushToBuffer(
          `### 📉 Poorly Covered Tests (${data.warnings.poorlyCovered.length})\n\n`
        );
        this.pushToBuffer(
          `*Tests with coverage below ${this.coverageThresholdPercent}%*\n\n`
        );
        for (const test of data.warnings.poorlyCovered) {
          this.pushToBuffer(
            `- **${test.testName}** - ${test.value} coverage\n`
          );
        }
        this.pushToBuffer('\n');
      }
    }

    // Test results table with coverage
    if (data.testTable && data.testTable.rows.length > 0) {
      this.pushToBuffer('## Test Results with Coverage\n\n');
      if (data.testTable.note) {
        this.pushToBuffer(`*${data.testTable.note}*\n\n`);
      }
      this.pushToBuffer(
        '<table style="width: 100%; border-collapse: collapse;">\n'
      );
      this.pushToBuffer('<thead>\n');
      this.pushToBuffer('<tr style="border-bottom: 2px solid;">\n');
      this.pushToBuffer(
        '<th style="text-align: left; padding: 8px; width: 45%;">Test Name</th>\n'
      );
      this.pushToBuffer(
        '<th style="text-align: left; padding: 8px; width: 20%;">Class Being Tested</th>\n'
      );
      this.pushToBuffer(
        '<th style="text-align: left; padding: 8px; width: 12%;">Outcome</th>\n'
      );
      this.pushToBuffer(
        '<th style="text-align: left; padding: 8px; width: 10%;">Per-Test Coverage</th>\n'
      );
      this.pushToBuffer(
        '<th style="text-align: left; padding: 8px; width: 13%;">Runtime</th>\n'
      );
      this.pushToBuffer('</tr>\n');
      this.pushToBuffer('</thead>\n');
      this.pushToBuffer('<tbody>\n');
      for (const row of data.testTable.rows) {
        const coverageStyle =
          row.coverage && row.hasWarning
            ? 'padding: 8px; font-weight: bold; color: #d32f2f;'
            : 'padding: 8px;';
        const runtimeStyle = row.hasWarning
          ? 'padding: 8px; font-weight: bold; color: #d32f2f;'
          : 'padding: 8px;';
        this.pushToBuffer('<tr style="border-bottom: 1px solid #ddd;">\n');
        this.pushToBuffer(
          `<td style="padding: 8px;"><code>${row.testName}</code>${
            row.hasWarning ? ' ⚠️' : ''
          }</td>\n`
        );
        this.pushToBuffer(`<td style="padding: 8px;">${row.className}</td>\n`);
        this.pushToBuffer(
          `<td style="padding: 8px;">${row.outcomeEmoji} ${row.outcome}</td>\n`
        );
        this.pushToBuffer(
          `<td style="${coverageStyle}">${row.coverage || 'N/A'}</td>\n`
        );
        this.pushToBuffer(`<td style="${runtimeStyle}">${row.runtime}</td>\n`);
        this.pushToBuffer('</tr>\n');
      }
      this.pushToBuffer('</tbody>\n');
      this.pushToBuffer('</table>\n\n');
    }

    // Passed tests section
    if (data.passedTests.length > 0) {
      this.pushToBuffer(`## ✅ Passed Tests (${data.passedTests.length})\n\n`);
      for (const test of data.passedTests) {
        this.pushToBuffer(`- ${test.testName}`);
        if (test.runtime) {
          this.pushToBuffer(
            test.isSlow
              ? ` (🐌 **${test.runtime}** - slow)`
              : ` (${test.runtime})`
          );
        }
        if (test.coverage) {
          this.pushToBuffer(
            test.hasLowCoverage
              ? ` (📉 **${test.coverage}** coverage - low)`
              : ` - ${test.coverage} coverage`
          );
        }
        this.pushToBuffer('\n');
      }
      this.pushToBuffer('\n');
    }

    // Skipped tests section
    if (data.skippedTests.length > 0) {
      this.pushToBuffer(
        `## ⏭️ Skipped Tests (${data.skippedTests.length})\n\n`
      );
      for (const test of data.skippedTests) {
        this.pushToBuffer(`- ${test.testName}\n`);
      }
      this.pushToBuffer('\n');
    }

    // Code coverage table
    if (data.coverageTable && data.coverageTable.rows.length > 0) {
      this.pushToBuffer('## Code Coverage by Class\n\n');
      if (data.coverageTable.note) {
        this.pushToBuffer(`*${data.coverageTable.note}*\n\n`);
      }
      this.pushToBuffer(
        '<table style="width: 100%; border-collapse: collapse;">\n'
      );
      this.pushToBuffer('<thead>\n');
      this.pushToBuffer('<tr style="border-bottom: 2px solid;">\n');
      this.pushToBuffer(
        '<th style="text-align: left; padding: 8px; width: 30%;">Class</th>\n'
      );
      this.pushToBuffer(
        '<th style="text-align: left; padding: 8px; width: 15%;">Coverage</th>\n'
      );
      this.pushToBuffer(
        '<th style="text-align: left; padding: 8px; width: 55%;">Uncovered Lines</th>\n'
      );
      this.pushToBuffer('</tr>\n');
      this.pushToBuffer('</thead>\n');
      this.pushToBuffer('<tbody>\n');
      for (const row of data.coverageTable.rows) {
        this.pushToBuffer('<tr style="border-bottom: 1px solid #ddd;">\n');
        this.pushToBuffer(
          `<td style="padding: 8px;"><code>${row.className}</code></td>\n`
        );
        this.pushToBuffer(`<td style="padding: 8px;">${row.percentage}</td>\n`);
        this.pushToBuffer(
          `<td style="padding: 8px;">${row.uncoveredLines}</td>\n`
        );
        this.pushToBuffer('</tr>\n');
      }
      this.pushToBuffer('</tbody>\n');
      this.pushToBuffer('</table>\n\n');
    }
  }

  private renderText(data: ReportData): void {
    this.pushToBuffer('Apex Test Results\n');
    this.pushToBuffer('==================\n\n');
    this.pushToBuffer(`Run completed: ${data.timestamp}\n\n`);

    // Summary
    this.pushToBuffer('Summary:\n');
    this.pushToBuffer(`  Passed:  ${data.summary.passed}\n`);
    this.pushToBuffer(`  Failed:  ${data.summary.failed}\n`);
    this.pushToBuffer(`  Skipped: ${data.summary.skipped}\n`);
    this.pushToBuffer(`  Total:   ${data.summary.total}\n`);
    this.pushToBuffer(`  Duration: ${data.summary.duration}\n\n`);

    // Failures section
    if (data.failures.length > 0) {
      this.pushToBuffer('Failures:\n');
      this.pushToBuffer('=========\n\n');
      for (const failure of data.failures) {
        this.pushToBuffer(`${failure.testName}\n`);
        this.pushToBuffer(`${'-'.repeat(failure.testName.length)}\n`);
        if (failure.message) {
          this.pushToBuffer(`Error:\n${failure.message}\n\n`);
        }
        if (failure.stackTrace) {
          this.pushToBuffer(`Stack Trace:\n${failure.stackTrace}\n\n`);
        }
        if (failure.duration) {
          this.pushToBuffer(`Duration: ${failure.duration}\n\n`);
        }
        this.pushToBuffer('\n');
      }
    }

    // Passed tests section
    if (data.passedTests.length > 0) {
      this.pushToBuffer('Passed Tests:\n');
      this.pushToBuffer('==============\n\n');
      for (const test of data.passedTests) {
        this.pushToBuffer(`  - ${test.testName}`);
        if (test.runtime) {
          this.pushToBuffer(` (${test.runtime})`);
        }
        this.pushToBuffer('\n');
      }
      this.pushToBuffer('\n');
    }

    // Skipped tests section
    if (data.skippedTests.length > 0) {
      this.pushToBuffer('Skipped Tests:\n');
      this.pushToBuffer('===============\n\n');
      for (const test of data.skippedTests) {
        this.pushToBuffer(`  - ${test.testName}\n`);
      }
      this.pushToBuffer('\n');
    }

    // Code coverage by class section
    if (data.coverageTable && data.coverageTable.rows.length > 0) {
      this.pushToBuffer('Code Coverage by Class:\n');
      this.pushToBuffer('=======================\n\n');
      for (const row of data.coverageTable.rows) {
        this.pushToBuffer(
          `  ${row.className}: ${row.percentage} (Uncovered: ${row.uncoveredLines})\n`
        );
      }
      this.pushToBuffer('\n');
    }
  }
}
