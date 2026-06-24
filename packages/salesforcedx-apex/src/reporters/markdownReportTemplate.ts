/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export interface ReportSection {
  type:
    | 'header'
    | 'summary'
    | 'failures'
    | 'warnings'
    | 'table'
    | 'list'
    | 'coverage';
  content: string;
}

export interface FailureTest {
  testName: string;
  duration?: string;
  message?: string;
  stackTrace?: string;
}

export interface WarningTest {
  testName: string;
  value: string;
  type: 'performance' | 'coverage';
}

export interface TestTableRow {
  testName: string;
  className: string;
  outcome: string;
  outcomeEmoji: string;
  coverage?: string;
  runtime: string;
  hasWarning: boolean;
}

export interface CoverageTableRow {
  className: string;
  percentage: string;
  uncoveredLines: string;
}

export interface ReportData {
  timestamp: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: string;
  };
  failures: FailureTest[];
  warnings: {
    poorlyPerforming: WarningTest[];
    poorlyCovered: WarningTest[];
  };
  testTable?: {
    rows: TestTableRow[];
    note?: string;
  };
  passedTests: Array<{
    testName: string;
    runtime?: string;
    coverage?: string;
    isSlow: boolean;
    hasLowCoverage: boolean;
  }>;
  skippedTests: Array<{
    testName: string;
  }>;
  coverageTable?: {
    rows: CoverageTableRow[];
    note?: string;
  };
}

/**
 * Renders markdown report from structured data
 */
export const renderMarkdownReport = (data: ReportData): string => {
  const sections: string[] = [
    '# Apex Test Results\n',
    `**Run completed:** ${data.timestamp}\n`,
    '## Summary\n',
    `- **Total Tests:** ${data.summary.total}\n`,
    `- ✅ **Passed:** ${data.summary.passed}\n`,
    `- ❌ **Failed:** ${data.summary.failed}\n`,
    ...(data.summary.skipped > 0
      ? [`- ⏭️ **Skipped:** ${data.summary.skipped}\n`]
      : []),
    `- ⏱️ **Duration:** ${data.summary.duration}\n`
  ];

  // Failures section
  if (data.failures.length > 0) {
    sections.push(`\n## ❌ Failures (${data.summary.failed})\n\n`);
    sections.push(
      ...data.failures.flatMap((failure) => [
        `### ${failure.testName}\n\n`,
        ...(failure.duration ? [`*Duration: ${failure.duration}*\n\n`] : []),
        ...(failure.message
          ? [
              '**Error Message**\n\n',
              '```\n',
              `${failure.message}\n`,
              '```\n\n'
            ]
          : []),
        ...(failure.stackTrace
          ? [
              '**Stack Trace**\n\n',
              '```\n',
              `${failure.stackTrace}\n`,
              '```\n\n'
            ]
          : []),
        '---\n\n'
      ])
    );
  }

  // Warnings section
  const hasWarnings =
    data.warnings.poorlyPerforming.length > 0 ||
    data.warnings.poorlyCovered.length > 0;
  if (hasWarnings) {
    sections.push('## ⚠️ Test Quality Warnings\n\n');

    if (data.warnings.poorlyPerforming.length > 0) {
      sections.push(
        `### 🐌 Poorly Performing Tests (${data.warnings.poorlyPerforming.length})\n\n`,
        `*Tests taking longer than ${data.warnings.poorlyPerforming[0]?.value || 'threshold'} (sorted by runtime, slowest first)*\n\n`,
        ...data.warnings.poorlyPerforming.map(
          (test) => `- **${test.testName}** - **${test.value}**\n`
        ),
        '\n'
      );
    }

    if (data.warnings.poorlyCovered.length > 0) {
      sections.push(
        `### 📉 Poorly Covered Tests (${data.warnings.poorlyCovered.length})\n\n`,
        `*Tests with coverage below threshold%*\n\n`,
        ...data.warnings.poorlyCovered.map(
          (test) => `- **${test.testName}** - ${test.value} coverage\n`
        ),
        '\n'
      );
    }
  }

  // Test results table
  if (data.testTable && data.testTable.rows.length > 0) {
    sections.push('## Test Results with Coverage\n\n');
    if (data.testTable.note) {
      sections.push(`*${data.testTable.note}*\n\n`);
    }
    sections.push(
      '<table style="width: 100%; border-collapse: collapse;">\n',
      '<thead>\n',
      '<tr style="border-bottom: 2px solid;">\n',
      '<th style="text-align: left; padding: 8px; width: 45%;">Test Name</th>\n',
      '<th style="text-align: left; padding: 8px; width: 20%;">Class Being Tested</th>\n',
      '<th style="text-align: left; padding: 8px; width: 12%;">Outcome</th>\n',
      '<th style="text-align: left; padding: 8px; width: 10%;">Per-Test Coverage</th>\n',
      '<th style="text-align: left; padding: 8px; width: 13%;">Runtime</th>\n',
      '</tr>\n',
      '</thead>\n',
      '<tbody>\n',
      ...data.testTable.rows
        .map((row) => {
          const coverageStyle =
            row.coverage && row.hasWarning
              ? 'padding: 8px; font-weight: bold; color: #d32f2f;'
              : 'padding: 8px;';
          const runtimeStyle = row.hasWarning
            ? 'padding: 8px; font-weight: bold; color: #d32f2f;'
            : 'padding: 8px;';
          return [
            '<tr style="border-bottom: 1px solid #ddd;">\n',
            `<td style="padding: 8px;"><code>${row.testName}</code>${row.hasWarning ? ' ⚠️' : ''}</td>\n`,
            `<td style="padding: 8px;">${row.className}</td>\n`,
            `<td style="padding: 8px;">${row.outcomeEmoji} ${row.outcome}</td>\n`,
            `<td style="${coverageStyle}">${row.coverage || 'N/A'}</td>\n`,
            `<td style="${runtimeStyle}">${row.runtime}</td>\n`,
            '</tr>\n'
          ];
        })
        .flat(),
      '</tbody>\n',
      '</table>\n\n'
    );
  }

  // Passed tests section
  if (data.passedTests.length > 0) {
    sections.push(`## ✅ Passed Tests (${data.summary.passed})\n\n`);
    sections.push(
      ...data.passedTests.map((test) => {
        const parts = [`- ${test.testName}`];
        if (test.runtime) {
          parts.push(
            test.isSlow
              ? ` (🐌 **${test.runtime}** - slow)`
              : ` (${test.runtime})`
          );
        }
        if (test.coverage) {
          parts.push(
            test.hasLowCoverage
              ? ` (📉 **${test.coverage}** coverage - low)`
              : ` - ${test.coverage} coverage`
          );
        }
        return parts.join('') + '\n';
      }),
      '\n'
    );
  }

  // Skipped tests section
  if (data.skippedTests.length > 0) {
    sections.push(`## ⏭️ Skipped Tests (${data.summary.skipped})\n\n`);
    sections.push(
      ...data.skippedTests.map((test) => `- ${test.testName}\n`),
      '\n'
    );
  }

  // Code coverage table
  if (data.coverageTable && data.coverageTable.rows.length > 0) {
    sections.push('## Code Coverage by Class\n\n');
    if (data.coverageTable.note) {
      sections.push(`*${data.coverageTable.note}*\n\n`);
    }
    sections.push(
      '<table style="width: 100%; border-collapse: collapse;">\n',
      '<thead>\n',
      '<tr style="border-bottom: 2px solid;">\n',
      '<th style="text-align: left; padding: 8px; width: 30%;">Class</th>\n',
      '<th style="text-align: left; padding: 8px; width: 15%;">Coverage</th>\n',
      '<th style="text-align: left; padding: 8px; width: 55%;">Uncovered Lines</th>\n',
      '</tr>\n',
      '</thead>\n',
      '<tbody>\n',
      ...data.coverageTable.rows
        .map((row) => [
          '<tr style="border-bottom: 1px solid #ddd;">\n',
          `<td style="padding: 8px;"><code>${row.className}</code></td>\n`,
          `<td style="padding: 8px;">${row.percentage}</td>\n`,
          `<td style="padding: 8px;">${row.uncoveredLines}</td>\n`,
          '</tr>\n'
        ])
        .flat(),
      '</tbody>\n',
      '</table>\n\n'
    );
  }

  return sections.join('');
};
