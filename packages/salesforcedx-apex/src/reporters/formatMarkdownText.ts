/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ReportData } from './markdownReportTemplate';
import type { ApexTestResultData, TestResult } from '../tests/types';
import * as Order from 'effect/Order';
import {
  escapeHtml,
  escapeMarkdown,
  formatDuration,
  formatTimestamp,
  getCoveragePercentage,
  getSeverityScore,
  getSummaryInfo,
  getTestNameInfo,
  hasPoorCoverage,
  isPoorlyPerforming,
  type MarkdownTextReporterOptions
} from './markdownTextReporter';

const buildReportData = (testResult: TestResult, options: Required<MarkdownTextReporterOptions>): ReportData => {
  const { passed, failed, skipped, total, duration } = getSummaryInfo(testResult.summary);
  const { codeCoverage, performanceThresholdMs, coverageThresholdPercent, sortOrder } = options;
  const descendingNumber = Order.reverse(Order.number);
  const runtimeOrder = Order.mapInput(descendingNumber, (test: ApexTestResultData) => test.runTime ?? 0);
  const coverageOrder = Order.mapInput(Order.number, (test: ApexTestResultData) =>
    codeCoverage ? (getCoveragePercentage(test.perClassCoverage?.[0]?.percentage) ?? 100) : 100
  );
  const severityOrder = Order.mapInput(descendingNumber, (test: ApexTestResultData) =>
    getSeverityScore(test, codeCoverage, performanceThresholdMs, coverageThresholdPercent)
  );
  const testOrder =
    sortOrder === 'runtime'
      ? Order.combine(runtimeOrder, coverageOrder)
      : sortOrder === 'coverage'
        ? Order.combine(coverageOrder, runtimeOrder)
        : severityOrder;
  const warningCoverageOrder = Order.mapInput(
    Order.number,
    (test: ApexTestResultData) => getCoveragePercentage(test.perClassCoverage?.[0]?.percentage) ?? 0
  );
  const coverageTableOrder = Order.mapInput(
    Order.number,
    (coverage: NonNullable<TestResult['codecoverage']>[number]) => getCoveragePercentage(coverage.percentage) ?? 0
  );
  const sortTests = (tests: ApexTestResultData[]): ApexTestResultData[] => [...tests].sort(testOrder);

  // Build failures data. Section counts come from the full-run summary.
  const failures = (testResult.tests?.filter(test => test.outcome?.toString() === 'Fail') ?? []).map(test => ({
    testName: escapeMarkdown(getTestNameInfo(test).testName),
    ...(test.runTime !== undefined && { duration: formatDuration(test.runTime) }),
    ...(test.message && { message: test.message }),
    ...(test.stackTrace && { stackTrace: test.stackTrace })
  }));
  // Identify poorly performing and poorly covered tests.
  const poorlyPerforming = (
    testResult.tests?.filter(test => isPoorlyPerforming(test.runTime, performanceThresholdMs)) ?? []
  )
    .sort(runtimeOrder)
    .map(test => ({
      testName: escapeMarkdown(getTestNameInfo(test).testName),
      value: test.runTime !== undefined ? formatDuration(test.runTime) : 'N/A',
      type: 'performance' as const
    }));
  const poorlyCovered = (
    codeCoverage
      ? (testResult.tests?.filter(test =>
          hasPoorCoverage(test.perClassCoverage?.[0]?.percentage, coverageThresholdPercent)
        ) ?? [])
      : []
  )
    .sort(warningCoverageOrder)
    .map(test => ({
      testName: escapeMarkdown(getTestNameInfo(test).testName),
      value: String(test.perClassCoverage?.[0]?.percentage ?? 'N/A'),
      type: 'coverage' as const
    }));

  // Build test table data. Table rows are HTML, not Markdown.
  const testTableRows =
    codeCoverage && testResult.tests
      ? sortTests(testResult.tests).map(test => {
          const { fullClassName, testName } = getTestNameInfo(test);
          const outcome = test.outcome?.toString() ?? 'Unknown';
          const coverage = test.perClassCoverage?.[0]?.percentage ?? 'N/A';
          return {
            testName: escapeHtml(testName),
            className: escapeHtml(fullClassName),
            outcome,
            outcomeEmoji: outcome === 'Pass' ? '✅' : outcome === 'Fail' ? '❌' : '⏭️',
            coverage: typeof coverage === 'string' ? coverage : 'N/A',
            runtime: test.runTime !== undefined ? formatDuration(test.runTime) : 'N/A',
            hasWarning:
              isPoorlyPerforming(test.runTime, performanceThresholdMs) ||
              hasPoorCoverage(coverage, coverageThresholdPercent)
          };
        })
      : [];
  // Build passed and skipped tests data.
  const passedTests = sortTests(testResult.tests?.filter(test => test.outcome?.toString() === 'Pass') ?? []).map(
    test => ({
      testName: escapeMarkdown(getTestNameInfo(test).testName),
      ...(test.runTime !== undefined && { runtime: formatDuration(test.runTime) }),
      ...(codeCoverage &&
        test.perClassCoverage?.[0]?.percentage && { coverage: String(test.perClassCoverage[0].percentage) }),
      isSlow: isPoorlyPerforming(test.runTime, performanceThresholdMs),
      hasLowCoverage: codeCoverage && hasPoorCoverage(test.perClassCoverage?.[0]?.percentage, coverageThresholdPercent)
    })
  );
  const skippedTests = (testResult.tests?.filter(test => test.outcome?.toString() === 'Skip') ?? []).map(test => ({
    testName: escapeMarkdown(getTestNameInfo(test).testName)
  }));

  // Coverage table is rendered as HTML <code>, so keep Markdown escapes out.
  const coverageTableRows =
    codeCoverage && testResult.codecoverage
      ? [...testResult.codecoverage].sort(coverageTableOrder).map(coverage => ({
          className: escapeHtml(coverage.name ?? 'Unknown'),
          percentage: coverage.percentage ?? '0%',
          uncoveredLines: (coverage.uncoveredLines ?? []).length > 0 ? coverage.uncoveredLines.join(', ') : 'None'
        }))
      : [];
  return {
    timestamp: formatTimestamp(options.timestamp),
    summary: { total, passed, failed, skipped, duration: formatDuration(duration) },
    failures,
    warnings: { poorlyPerforming, poorlyCovered },
    ...(testTableRows.length > 0 && {
      testTable: {
        rows: testTableRows,
        note: 'Note: Coverage shown is per-test coverage for the class being tested. Overall class coverage is shown in the "Code Coverage by Class" section below.'
      }
    }),
    passedTests,
    skippedTests,
    ...(coverageTableRows.length > 0 && {
      coverageTable: {
        rows: coverageTableRows,
        note: 'This section shows the overall code coverage for each class after all tests have run. This may differ from per-test coverage shown in the table above.'
      }
    })
  };
};

const renderMarkdown = (data: ReportData, options: Required<MarkdownTextReporterOptions>): string =>
  [
    '# Apex Test Results\n',
    `**Run completed:** ${data.timestamp}\n`,
    '\n## Summary\n\n',
    `- **Total Tests:** ${data.summary.total}\n`,
    `- ✅ **Passed:** ${data.summary.passed}\n`,
    `- ❌ **Failed:** ${data.summary.failed}\n`,
    data.summary.skipped > 0 ? `- ⏭️ **Skipped:** ${data.summary.skipped}\n` : '',
    `- ⏱️ **Duration:** ${data.summary.duration}\n\n`,
    // Failures section (header uses full-run count from summary).
    ...(data.failures.length > 0
      ? [
          `## ❌ Failures (${data.summary.failed})\n\n`,
          ...data.failures.map(failure =>
            [
              `### ${failure.testName}\n\n`,
              failure.duration ? `*Duration: ${failure.duration}*\n\n` : '',
              failure.message ? `**Error Message**\n\n\`\`\`\n${failure.message}\n\`\`\`\n\n` : '',
              failure.stackTrace ? `**Stack Trace**\n\n\`\`\`\n${failure.stackTrace}\n\`\`\`\n\n` : '',
              '---\n\n'
            ].join('')
          )
        ]
      : []),
    // Warnings section.
    data.warnings.poorlyPerforming.length > 0 || data.warnings.poorlyCovered.length > 0
      ? '## ⚠️ Test Quality Warnings\n\n'
      : '',
    ...(data.warnings.poorlyPerforming.length > 0
      ? [
          `### 🐌 Poorly Performing Tests (${data.warnings.poorlyPerforming.length})\n\n`,
          `*Tests taking longer than ${formatDuration(options.performanceThresholdMs)} (sorted by runtime, slowest first)*\n\n`,
          ...data.warnings.poorlyPerforming.map(test => `- **${test.testName}** - **${test.value}**\n`),
          '\n'
        ]
      : []),
    ...(data.warnings.poorlyCovered.length > 0
      ? [
          `### 📉 Poorly Covered Tests (${data.warnings.poorlyCovered.length})\n\n`,
          `*Tests with coverage below ${options.coverageThresholdPercent}%*\n\n`,
          ...data.warnings.poorlyCovered.map(test => `- **${test.testName}** - ${test.value} coverage\n`),
          '\n'
        ]
      : []),
    // Test results table with coverage.
    ...(data.testTable && data.testTable.rows.length > 0
      ? [
          '## Test Results with Coverage\n\n',
          data.testTable.note ? `*${data.testTable.note}*\n\n` : '',
          '<table style="width: 100%; border-collapse: collapse;">\n<thead>\n<tr style="border-bottom: 2px solid;">\n',
          '<th style="text-align: left; padding: 8px; width: 45%;">Test Name</th>\n',
          '<th style="text-align: left; padding: 8px; width: 20%;">Class Being Tested</th>\n',
          '<th style="text-align: left; padding: 8px; width: 12%;">Outcome</th>\n',
          '<th style="text-align: left; padding: 8px; width: 10%;">Per-Test Coverage</th>\n',
          '<th style="text-align: left; padding: 8px; width: 13%;">Runtime</th>\n</tr>\n</thead>\n<tbody>\n',
          ...data.testTable.rows.map(row =>
            [
              '<tr style="border-bottom: 1px solid #ddd;">\n',
              `<td style="padding: 8px;"><code>${row.testName}</code>${row.hasWarning ? ' ⚠️' : ''}</td>\n`,
              `<td style="padding: 8px;">${row.className}</td>\n`,
              `<td style="padding: 8px;">${row.outcomeEmoji} ${row.outcome}</td>\n`,
              `<td style="${row.coverage && row.hasWarning ? 'padding: 8px; font-weight: bold; color: #d32f2f;' : 'padding: 8px;'}">${row.coverage || 'N/A'}</td>\n`,
              `<td style="${row.hasWarning ? 'padding: 8px; font-weight: bold; color: #d32f2f;' : 'padding: 8px;'}">${row.runtime}</td>\n`,
              '</tr>\n'
            ].join('')
          ),
          '</tbody>\n</table>\n\n'
        ]
      : []),
    // Passed tests section (header uses full-run count from summary).
    ...(data.passedTests.length > 0
      ? [
          `## ✅ Passed Tests (${data.summary.passed})\n\n`,
          ...data.passedTests.map(test =>
            [
              `- ${test.testName}`,
              test.runtime ? (test.isSlow ? ` (🐌 **${test.runtime}** - slow)` : ` (${test.runtime})`) : '',
              test.coverage
                ? test.hasLowCoverage
                  ? ` (📉 **${test.coverage}** coverage - low)`
                  : ` - ${test.coverage} coverage`
                : '',
              '\n'
            ].join('')
          ),
          '\n'
        ]
      : []),
    // Skipped tests section (header uses full-run count from summary).
    ...(data.skippedTests.length > 0
      ? [
          `## ⏭️ Skipped Tests (${data.summary.skipped})\n\n`,
          ...data.skippedTests.map(test => `- ${test.testName}\n`),
          '\n'
        ]
      : []),
    // Code coverage table.
    ...(data.coverageTable && data.coverageTable.rows.length > 0
      ? [
          '## Code Coverage by Class\n\n',
          data.coverageTable.note ? `*${data.coverageTable.note}*\n\n` : '',
          '<table style="width: 100%; border-collapse: collapse;">\n<thead>\n<tr style="border-bottom: 2px solid;">\n',
          '<th style="text-align: left; padding: 8px; width: 30%;">Class</th>\n',
          '<th style="text-align: left; padding: 8px; width: 15%;">Coverage</th>\n',
          '<th style="text-align: left; padding: 8px; width: 55%;">Uncovered Lines</th>\n</tr>\n</thead>\n<tbody>\n',
          ...data.coverageTable.rows.map(row =>
            [
              '<tr style="border-bottom: 1px solid #ddd;">\n',
              `<td style="padding: 8px;"><code>${row.className}</code></td>\n`,
              `<td style="padding: 8px;">${row.percentage}</td>\n`,
              `<td style="padding: 8px;">${row.uncoveredLines}</td>\n</tr>\n`
            ].join('')
          ),
          '</tbody>\n</table>\n\n'
        ]
      : [])
  ].join('');

const renderText = (data: ReportData): string =>
  [
    'Apex Test Results\n==================\n\n',
    `Run completed: ${data.timestamp}\n\n`,
    // Summary.
    'Summary:\n',
    `  Passed:  ${data.summary.passed}\n`,
    `  Failed:  ${data.summary.failed}\n`,
    `  Skipped: ${data.summary.skipped}\n`,
    `  Total:   ${data.summary.total}\n`,
    `  Duration: ${data.summary.duration}\n\n`,
    // Failures section.
    ...(data.failures.length > 0
      ? [
          'Failures:\n=========\n\n',
          ...data.failures.map(failure =>
            [
              `${failure.testName}\n${'-'.repeat(failure.testName.length)}\n`,
              failure.message ? `Error:\n${failure.message}\n\n` : '',
              failure.stackTrace ? `Stack Trace:\n${failure.stackTrace}\n\n` : '',
              failure.duration ? `Duration: ${failure.duration}\n\n` : '',
              '\n'
            ].join('')
          )
        ]
      : []),
    // Passed tests section.
    ...(data.passedTests.length > 0
      ? [
          'Passed Tests:\n==============\n\n',
          ...data.passedTests.map(test => `  - ${test.testName}${test.runtime ? ` (${test.runtime})` : ''}\n`),
          '\n'
        ]
      : []),
    // Skipped tests section.
    ...(data.skippedTests.length > 0
      ? ['Skipped Tests:\n===============\n\n', ...data.skippedTests.map(test => `  - ${test.testName}\n`), '\n']
      : []),
    // Code coverage by class section.
    ...(data.coverageTable && data.coverageTable.rows.length > 0
      ? [
          'Code Coverage by Class:\n=======================\n\n',
          ...data.coverageTable.rows.map(
            row => `  ${row.className}: ${row.percentage} (Uncovered: ${row.uncoveredLines})\n`
          ),
          '\n'
        ]
      : [])
  ].join('');

export const formatMarkdownText = (testResult: TestResult, options: MarkdownTextReporterOptions = {}): string => {
  const defaults = {
    format: options.format ?? 'markdown',
    sortOrder: options.sortOrder ?? 'runtime',
    performanceThresholdMs: options.performanceThresholdMs ?? 5000,
    coverageThresholdPercent: options.coverageThresholdPercent ?? 75,
    codeCoverage: options.codeCoverage ?? false,
    timestamp: options.timestamp ?? new Date()
  };
  const data = buildReportData(testResult, defaults);
  return defaults.format === 'markdown' ? renderMarkdown(data, defaults) : renderText(data);
};
