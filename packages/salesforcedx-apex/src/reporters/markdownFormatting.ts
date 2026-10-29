/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Order from 'effect/Order';
import { type TestResult, type ApexTestResultData } from '../tests/types';
import { escapeMarkdown } from './escaping';
import { formatHtmlTable } from './htmlTable';
import {
  type ReportData,
  type FailureTest,
  type WarningTest,
  type TestTableRow,
  type CoverageTableRow
} from './markdownReportTemplate';
import {
  type MarkdownTextReporterOptions,
  formatDuration,
  isPoorlyPerforming,
  hasPoorCoverage,
  getCoveragePercentage,
  getTestNameInfo,
  formatTimestamp,
  getSummaryInfo,
  getSeverityScore
} from './markdownTextReporter';

export const formatMarkdownText = (testResult: TestResult, options: MarkdownTextReporterOptions = {}): string => {
  const {
    format = 'markdown',
    sortOrder = 'runtime',
    performanceThresholdMs = 5000,
    coverageThresholdPercent = 75,
    codeCoverage = false,
    timestamp = new Date()
  } = options;
  const buildReportData = (): ReportData => {
    const { passed, failed, skipped, total, duration } = getSummaryInfo(testResult.summary);
    const timestampStr = formatTimestamp(timestamp);

    const descendingNumber = Order.reverse(Order.number);
    const runtimeOrder = Order.mapInput(descendingNumber, (test: ApexTestResultData) => test.runTime ?? 0);
    const coverageOrder = Order.mapInput(Order.number, (test: ApexTestResultData) =>
      codeCoverage ? (getCoveragePercentage(test.perClassCoverage?.[0]?.percentage) ?? 100) : 100
    );
    const severityOrder = Order.mapInput(descendingNumber, (test: ApexTestResultData) =>
      getSeverityScore(test, codeCoverage, performanceThresholdMs, coverageThresholdPercent)
    );
    const runtimeFirstOrder = Order.combine(runtimeOrder, coverageOrder);
    const coverageFirstOrder = Order.combine(coverageOrder, runtimeOrder);
    const testOrder =
      sortOrder === 'runtime' ? runtimeFirstOrder : sortOrder === 'coverage' ? coverageFirstOrder : severityOrder;
    const warningCoverageOrder = Order.mapInput(
      Order.number,
      (test: ApexTestResultData) => getCoveragePercentage(test.perClassCoverage?.[0]?.percentage) ?? 0
    );
    const coverageTableOrder = Order.mapInput(
      Order.number,
      (coverage: NonNullable<TestResult['codecoverage']>[number]) => getCoveragePercentage(coverage.percentage) ?? 0
    );

    // Helper function to sort tests based on sort order
    const sortTests = (tests: ApexTestResultData[]): ApexTestResultData[] => [...tests].sort(testOrder);
    // Build data structures using spread operators
    const failedTests = testResult.tests?.filter(test => test.outcome?.toString() === 'Fail') ?? [];
    const passedTests = testResult.tests?.filter(test => test.outcome?.toString() === 'Pass') ?? [];
    const skippedTests = testResult.tests?.filter(test => test.outcome?.toString() === 'Skip') ?? [];

    // Build failures data
    const failures: FailureTest[] = failedTests.map(test => {
      const { testName } = getTestNameInfo(test);
      return {
        testName,
        ...(test.runTime !== undefined && {
          duration: formatDuration(test.runTime)
        }),
        ...(test.message && { message: test.message }),
        ...(test.stackTrace && { stackTrace: test.stackTrace })
      };
    });

    // Identify poorly performing and poorly covered tests
    const poorlyPerformingTests =
      testResult.tests?.filter(test => isPoorlyPerforming(test.runTime, performanceThresholdMs)) ?? [];
    const poorlyCoveredTests = codeCoverage
      ? (testResult.tests?.filter(test =>
          hasPoorCoverage(test.perClassCoverage?.[0]?.percentage, coverageThresholdPercent)
        ) ?? [])
      : [];

    // Build warnings data
    const poorlyPerformingWarnings: WarningTest[] = [...poorlyPerformingTests].sort(runtimeOrder).map(test => {
      const { testName } = getTestNameInfo(test);
      return {
        testName,
        value: test.runTime !== undefined ? formatDuration(test.runTime) : 'N/A',
        type: 'performance' as const
      };
    });

    const poorlyCoveredWarnings: WarningTest[] = [...poorlyCoveredTests].sort(warningCoverageOrder).map(test => {
      const { testName } = getTestNameInfo(test);
      const coverage = test.perClassCoverage?.[0]?.percentage ?? 'N/A';
      return {
        testName,
        value: typeof coverage === 'string' ? coverage : String(coverage),
        type: 'coverage' as const
      };
    });

    // Build test table data
    const testTableRows: TestTableRow[] =
      codeCoverage && testResult.tests
        ? sortTests(testResult.tests).map(test => {
            const { fullClassName, testName } = getTestNameInfo(test);
            const outcome = test.outcome?.toString() ?? 'Unknown';
            const coverage = test.perClassCoverage?.[0]?.percentage ?? 'N/A';
            const coverageStr = typeof coverage === 'string' ? coverage : 'N/A';
            const runtime = test.runTime !== undefined ? formatDuration(test.runTime) : 'N/A';
            const outcomeEmoji = outcome === 'Pass' ? '✅' : outcome === 'Fail' ? '❌' : '⏭️';
            const isSlow = isPoorlyPerforming(test.runTime, performanceThresholdMs);
            const hasLowCoverage = hasPoorCoverage(coverage, coverageThresholdPercent);

            return {
              testName,
              className: fullClassName,
              outcome,
              outcomeEmoji,
              coverage: coverageStr,
              runtime,
              hasWarning: isSlow || hasLowCoverage
            };
          })
        : [];

    // Build passed tests data
    const passedTestsData = sortTests(passedTests).map(test => {
      const { testName } = getTestNameInfo(test);
      const isSlow = isPoorlyPerforming(test.runTime, performanceThresholdMs);
      const hasLowCoverage =
        codeCoverage && hasPoorCoverage(test.perClassCoverage?.[0]?.percentage, coverageThresholdPercent);

      return {
        testName,
        ...(test.runTime !== undefined && {
          runtime: formatDuration(test.runTime)
        }),
        ...(codeCoverage &&
          test.perClassCoverage?.[0]?.percentage && {
            coverage: String(test.perClassCoverage[0].percentage)
          }),
        isSlow,
        hasLowCoverage
      };
    });

    // Build skipped tests data
    const skippedTestsData = skippedTests.map(test => {
      const { testName } = getTestNameInfo(test);
      return { testName };
    });

    // Build coverage table data
    const coverageTableRows: CoverageTableRow[] =
      codeCoverage && testResult.codecoverage
        ? [...testResult.codecoverage].sort(coverageTableOrder).map(coverageItem => {
            const className = coverageItem.name ?? 'Unknown';
            const percentage = coverageItem.percentage ?? '0%';
            const uncoveredLines = coverageItem.uncoveredLines ?? [];
            return {
              className,
              percentage,
              uncoveredLines: uncoveredLines.length > 0 ? uncoveredLines.join(', ') : 'None'
            };
          })
        : [];

    // Build report data object
    return {
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
  };

  const data = buildReportData();
  return format === 'markdown'
    ? renderMarkdown(data, performanceThresholdMs, coverageThresholdPercent)
    : renderText(data);
};

const renderMarkdown = (data: ReportData, performanceThresholdMs: number, coverageThresholdPercent: number): string =>
  [
    '# Apex Test Results\n',
    `**Run completed:** ${data.timestamp}\n`,
    '\n## Summary\n\n',
    `- **Total Tests:** ${data.summary.total}\n`,
    `- ✅ **Passed:** ${data.summary.passed}\n`,
    `- ❌ **Failed:** ${data.summary.failed}\n`,
    ...(data.summary.skipped > 0 ? [`- ⏭️ **Skipped:** ${data.summary.skipped}\n`] : []),
    `- ⏱️ **Duration:** ${data.summary.duration}\n\n`,
    // Failures section (header uses full-run count from summary)
    ...(data.failures.length > 0
      ? [
          `## ❌ Failures (${data.summary.failed})\n\n`,
          ...data.failures.flatMap(failure => [
            `### ${escapeMarkdown(failure.testName)}\n\n`,
            ...(failure.duration ? [`*Duration: ${failure.duration}*\n\n`] : []),
            ...(failure.message ? [`**Error Message**\n\n\`\`\`\n${failure.message}\n\`\`\`\n\n`] : []),
            ...(failure.stackTrace ? [`**Stack Trace**\n\n\`\`\`\n${failure.stackTrace}\n\`\`\`\n\n`] : []),
            '---\n\n'
          ])
        ]
      : []),
    // Warnings section
    ...(data.warnings.poorlyPerforming.length > 0 || data.warnings.poorlyCovered.length > 0
      ? ['## ⚠️ Test Quality Warnings\n\n']
      : []),
    ...(data.warnings.poorlyPerforming.length > 0
      ? [
          `### 🐌 Poorly Performing Tests (${data.warnings.poorlyPerforming.length})\n\n`,
          `*Tests taking longer than ${formatDuration(performanceThresholdMs)} (sorted by runtime, slowest first)*\n\n`,
          ...data.warnings.poorlyPerforming.map(test => `- **${escapeMarkdown(test.testName)}** - **${test.value}**\n`),
          '\n'
        ]
      : []),
    ...(data.warnings.poorlyCovered.length > 0
      ? [
          `### 📉 Poorly Covered Tests (${data.warnings.poorlyCovered.length})\n\n`,
          `*Tests with coverage below ${coverageThresholdPercent}%*\n\n`,
          ...data.warnings.poorlyCovered.map(
            test => `- **${escapeMarkdown(test.testName)}** - ${test.value} coverage\n`
          ),
          '\n'
        ]
      : []),
    // Test results table with coverage
    ...(data.testTable
      ? [
          '## Test Results with Coverage\n\n',
          ...(data.testTable.note ? [`*${data.testTable.note}*\n\n`] : []),
          formatHtmlTable(data.testTable.rows, [
            {
              label: 'Test Name',
              width: 45,
              cell: row => ({ text: row.testName, code: true, warning: row.hasWarning })
            },
            { label: 'Class Being Tested', width: 20, cell: row => ({ text: row.className }) },
            { label: 'Outcome', width: 12, cell: row => ({ text: `${row.outcomeEmoji} ${row.outcome}` }) },
            {
              label: 'Per-Test Coverage',
              width: 10,
              cell: row => ({ text: row.coverage || 'N/A', highlight: Boolean(row.coverage) && row.hasWarning })
            },
            { label: 'Runtime', width: 13, cell: row => ({ text: row.runtime, highlight: row.hasWarning }) }
          ])
        ]
      : []),
    // Passed tests section (header uses full-run count from summary)
    ...(data.passedTests.length > 0
      ? [
          `## ✅ Passed Tests (${data.summary.passed})\n\n`,
          ...data.passedTests.map(test =>
            [
              `- ${escapeMarkdown(test.testName)}`,
              ...(test.runtime ? [test.isSlow ? ` (🐌 **${test.runtime}** - slow)` : ` (${test.runtime})`] : []),
              ...(test.coverage
                ? [test.hasLowCoverage ? ` (📉 **${test.coverage}** coverage - low)` : ` - ${test.coverage} coverage`]
                : []),
              '\n'
            ].join('')
          ),
          '\n'
        ]
      : []),
    // Skipped tests section (header uses full-run count from summary)
    ...(data.skippedTests.length > 0
      ? [
          `## ⏭️ Skipped Tests (${data.summary.skipped})\n\n`,
          ...data.skippedTests.map(test => `- ${escapeMarkdown(test.testName)}\n`),
          '\n'
        ]
      : []),
    // Code coverage table
    ...(data.coverageTable
      ? [
          '## Code Coverage by Class\n\n',
          ...(data.coverageTable.note ? [`*${data.coverageTable.note}*\n\n`] : []),
          formatHtmlTable(data.coverageTable.rows, [
            { label: 'Class', width: 30, cell: row => ({ text: row.className, code: true }) },
            { label: 'Coverage', width: 15, cell: row => ({ text: row.percentage }) },
            { label: 'Uncovered Lines', width: 55, cell: row => ({ text: row.uncoveredLines }) }
          ])
        ]
      : [])
  ].join('');

const renderText = (data: ReportData): string =>
  [
    'Apex Test Results\n',
    '==================\n\n',
    `Run completed: ${data.timestamp}\n\n`,
    // Summary
    'Summary:\n',
    `  Passed:  ${data.summary.passed}\n`,
    `  Failed:  ${data.summary.failed}\n`,
    `  Skipped: ${data.summary.skipped}\n`,
    `  Total:   ${data.summary.total}\n`,
    `  Duration: ${data.summary.duration}\n\n`,
    // Failures section
    ...(data.failures.length > 0
      ? [
          'Failures:\n=========\n\n',
          ...data.failures.flatMap(failure => [
            `${failure.testName}\n${'-'.repeat(failure.testName.length)}\n`,
            ...(failure.message ? [`Error:\n${failure.message}\n\n`] : []),
            ...(failure.stackTrace ? [`Stack Trace:\n${failure.stackTrace}\n\n`] : []),
            ...(failure.duration ? [`Duration: ${failure.duration}\n\n`] : []),
            '\n'
          ])
        ]
      : []),
    // Passed tests section
    ...(data.passedTests.length > 0
      ? [
          'Passed Tests:\n==============\n\n',
          ...data.passedTests.map(test => `  - ${test.testName}${test.runtime ? ` (${test.runtime})` : ''}\n`),
          '\n'
        ]
      : []),
    // Skipped tests section
    ...(data.skippedTests.length > 0
      ? ['Skipped Tests:\n===============\n\n', ...data.skippedTests.map(test => `  - ${test.testName}\n`), '\n']
      : []),
    // Code coverage by class section
    ...(data.coverageTable
      ? [
          'Code Coverage by Class:\n=======================\n\n',
          ...data.coverageTable.rows.map(
            row => `  ${row.className}: ${row.percentage} (Uncovered: ${row.uncoveredLines})\n`
          ),
          '\n'
        ]
      : [])
  ].join('');
