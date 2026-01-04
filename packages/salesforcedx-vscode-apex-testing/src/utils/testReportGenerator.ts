/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TestResult } from '@salesforce/apex-node';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { retrieveCoverageThreshold, retrievePerformanceThreshold } from '../settings';

export type OutputFormat = 'markdown' | 'text';
export type TestSortOrder = 'runtime' | 'coverage' | 'severity';

/** Escapes markdown special characters */
const escapeMarkdown = (text: string): string => text.replaceAll(/[\\`*_{}[\]()#+\-!]/g, '\\$&');

/** Formats duration in milliseconds to a human-readable string */
const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};

/** Checks if a test is poorly performing (takes too long) */
const isPoorlyPerforming = (runTime: number | undefined, thresholdMs: number): boolean =>
  runTime !== undefined && runTime > thresholdMs;

/** Checks if a test has poor coverage */
const hasPoorCoverage = (coverage: string | number | undefined, thresholdPercent: number): boolean => {
  if (coverage === undefined || coverage === 'N/A') {
    return false;
  }
  if (typeof coverage === 'string') {
    const numericValue = parseFloat(coverage.replace('%', ''));
    return !isNaN(numericValue) && numericValue < thresholdPercent;
  }
  return coverage < thresholdPercent;
};

/** Extracts numeric coverage percentage from coverage value */
const getCoveragePercentage = (coverage?: string | number): number | null => {
  if (coverage === undefined || coverage === 'N/A') {
    return null;
  }
  if (typeof coverage === 'string') {
    const numericValue = parseFloat(coverage.replace('%', ''));
    return isNaN(numericValue) ? null : numericValue;
  }
  return coverage;
};

/** Extracts test name information from a test */
const getTestNameInfo = (test: TestResult['tests'][0]) => {
  const className = test.apexClass?.name ?? 'Unknown';
  const namespacePrefix = test.apexClass?.namespacePrefix;
  const fullClassName = namespacePrefix ? `${namespacePrefix}.${className}` : className;
  const methodName = test.methodName ?? 'Unknown';
  const testName = `${fullClassName}.${methodName}`;
  return { className, namespacePrefix, fullClassName, methodName, testName };
};

/** Formats timestamp to a string */
const formatTimestamp = (timestamp: Date): string =>
  timestamp.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

/** Extracts summary information from test result */
const getSummaryInfo = (summary: TestResult['summary']) => {
  const passed = summary?.passing ?? 0;
  const failed = summary?.failing ?? 0;
  const skipped = summary?.skipped ?? 0;
  const total = summary?.testsRan ?? 0;
  const duration =
    summary?.outcome === 'Passed' || summary?.outcome === 'Failed' ? (summary?.testExecutionTimeInMs ?? 0) : 0;
  return { passed, failed, skipped, total, duration };
};

/** Calculates a severity score for sorting (higher = worse) */
const getSeverityScore = (
  test: TestResult['tests'][0],
  codeCoverage: boolean,
  performanceThresholdMs: number,
  coverageThresholdPercent: number
): number => {
  let score = 0;

  // Both issues = highest priority (score 10000+)
  const isSlow = isPoorlyPerforming(test.runTime, performanceThresholdMs);
  const hasLowCoverage =
    codeCoverage && hasPoorCoverage(test.perClassCoverage?.[0]?.percentage, coverageThresholdPercent);

  if (isSlow && hasLowCoverage) {
    score += 10_000;
  } else if (isSlow) {
    score += 5000;
  } else if (hasLowCoverage) {
    score += 5000;
  }

  // Add runtime (longer = worse, but only if it's a problem)
  if (test.runTime !== undefined) {
    score += test.runTime;
  }

  // Subtract coverage (lower = worse, but only if it's a problem)
  if (codeCoverage && hasLowCoverage) {
    const coverage = getCoveragePercentage(test.perClassCoverage?.[0]?.percentage);
    if (coverage !== null) {
      score += (100 - coverage) * 100; // Lower coverage = higher score
    }
  }

  return score;
};

/** Generates a markdown report from test results */
export const generateMarkdownReport = (
  result: TestResult,
  timestamp: Date,
  codeCoverage: boolean = false,
  sortOrder: TestSortOrder = 'runtime'
): string => {
  // Retrieve thresholds from settings
  const performanceThresholdMs = retrievePerformanceThreshold();
  const coverageThresholdPercent = retrieveCoverageThreshold();

  const summary = result.summary;
  const passed = summary?.passing ?? 0;
  const failed = summary?.failing ?? 0;
  const skipped = summary?.skipped ?? 0;
  const total = summary?.testsRan ?? 0;
  const duration =
    summary?.outcome === 'Passed' || summary?.outcome === 'Failed' ? (summary?.testExecutionTimeInMs ?? 0) : 0;

  const timestampStr = timestamp.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  let report = '# Apex Test Results\n\n';
  report += `**Run completed:** ${timestampStr}\n\n`;

  // Helper function to sort tests based on sort order
  const sortTests = (tests: typeof result.tests): typeof result.tests => {
    if (!tests) {
      return tests;
    }
    return [...tests].toSorted((a, b) => {
      // Extract runtime and coverage values once
      const runtimeA = a.runTime ?? 0;
      const runtimeB = b.runTime ?? 0;
      const coverageA = codeCoverage ? (getCoveragePercentage(a.perClassCoverage?.[0]?.percentage) ?? 100) : 100;
      const coverageB = codeCoverage ? (getCoveragePercentage(b.perClassCoverage?.[0]?.percentage) ?? 100) : 100;

      if (sortOrder === 'runtime') {
        // Sort by runtime (slowest first), then by coverage (lowest first) if runtime is equal
        if (runtimeB !== runtimeA) {
          return runtimeB - runtimeA;
        }
        return coverageA - coverageB;
      } else if (sortOrder === 'coverage') {
        // Sort by coverage (lowest first), then by runtime (slowest first) if coverage is equal
        if (coverageA !== coverageB) {
          return coverageA - coverageB;
        }
        return runtimeB - runtimeA;
      } else {
        // Sort by severity (worst first)
        const scoreA = getSeverityScore(a, codeCoverage, performanceThresholdMs, coverageThresholdPercent);
        const scoreB = getSeverityScore(b, codeCoverage, performanceThresholdMs, coverageThresholdPercent);
        return scoreB - scoreA;
      }
    });
  };

  // Summary section with cleaner formatting
  report += '## Summary\n\n';
  report += `- **Total Tests:** ${total}\n`;
  report += `- ✅ **Passed:** ${passed}\n`;
  report += `- ❌ **Failed:** ${failed}\n`;
  if (skipped > 0) {
    report += `- ⏭️ **Skipped:** ${skipped}\n`;
  }
  report += `- ⏱️ **Duration:** ${formatDuration(duration)}\n\n`;

  // Failures section
  const failedTests = result.tests?.filter(test => test.outcome?.toString() === 'Fail') ?? [];
  if (failedTests.length > 0) {
    report += `## ❌ Failures (${failedTests.length})\n\n`;
    for (const test of failedTests) {
      const { testName } = getTestNameInfo(test);

      report += `### ${escapeMarkdown(testName)}\n\n`;
      if (test.runTime !== undefined) {
        report += `*Duration: ${formatDuration(test.runTime)}*\n\n`;
      }
      if (test.message) {
        report += '**Error Message**\n\n';
        report += `\`\`\`\n${test.message}\n\`\`\`\n\n`;
      }
      if (test.stackTrace) {
        report += '**Stack Trace**\n\n';
        report += `\`\`\`\n${test.stackTrace}\n\`\`\`\n\n`;
      }
      report += '---\n\n';
    }
  }

  // Identify poorly performing and poorly covered tests
  const poorlyPerformingTests: typeof result.tests = [];
  const poorlyCoveredTests: typeof result.tests = [];

  if (result.tests) {
    for (const test of result.tests) {
      if (isPoorlyPerforming(test.runTime, performanceThresholdMs)) {
        poorlyPerformingTests.push(test);
      }
      if (codeCoverage) {
        const coverage = test.perClassCoverage?.[0]?.percentage;
        if (hasPoorCoverage(coverage, coverageThresholdPercent)) {
          poorlyCoveredTests.push(test);
        }
      }
    }
  }

  // Add warnings section for poorly performing and poorly covered tests
  if (poorlyPerformingTests.length > 0 || poorlyCoveredTests.length > 0) {
    report += '## ⚠️ Test Quality Warnings\n\n';

    if (poorlyPerformingTests.length > 0) {
      // Sort by runtime descending (worst first)
      const sortedPoorlyPerforming = [...poorlyPerformingTests].toSorted((a, b) => {
        const runtimeA = a.runTime ?? 0;
        const runtimeB = b.runTime ?? 0;
        return runtimeB - runtimeA; // Descending order
      });

      report += `### 🐌 Poorly Performing Tests (${poorlyPerformingTests.length})\n\n`;
      report += `*Tests taking longer than ${formatDuration(performanceThresholdMs)} (sorted by runtime, slowest first)*\n\n`;
      for (const test of sortedPoorlyPerforming) {
        const { testName } = getTestNameInfo(test);
        const runtime = test.runTime !== undefined ? formatDuration(test.runTime) : 'N/A';

        report += `- **${escapeMarkdown(testName)}** - **${runtime}**\n`;
      }
      report += '\n';
    }

    if (poorlyCoveredTests.length > 0) {
      // Sort by coverage ascending (lowest/worst first)
      const sortedPoorlyCovered = [...poorlyCoveredTests].toSorted((a, b) => {
        const coverageA = getCoveragePercentage(a.perClassCoverage?.[0]?.percentage) ?? 0;
        const coverageB = getCoveragePercentage(b.perClassCoverage?.[0]?.percentage) ?? 0;
        return coverageA - coverageB; // Ascending order (lowest first)
      });

      report += `### 📉 Poorly Covered Tests (${poorlyCoveredTests.length})\n\n`;
      report += `*Tests with coverage below ${coverageThresholdPercent}%*\n\n`;
      for (const test of sortedPoorlyCovered) {
        const { testName } = getTestNameInfo(test);
        const coverage = test.perClassCoverage?.[0]?.percentage ?? 'N/A';
        const coverageStr = typeof coverage === 'string' ? coverage : String(coverage);

        report += `- **${escapeMarkdown(testName)}** - ${coverageStr} coverage\n`;
      }
      report += '\n';
    }
  }

  // Test results table with coverage (if available)
  if (codeCoverage && result.tests && result.tests.length > 0) {
    // Sort tests based on sort order
    const sortedTests = sortTests(result.tests) ?? [];

    report += '## Test Results with Coverage\n\n';
    report +=
      '*Note: Coverage shown is per-test coverage for the class being tested. Overall class coverage is shown in the "Code Coverage by Class" section below.*\n\n';
    report += '<table style="width: 100%; border-collapse: collapse;">\n';
    report += '<thead>\n';
    report += '<tr style="border-bottom: 2px solid;">\n';
    report += '<th style="text-align: left; padding: 8px; width: 45%;">Test Name</th>\n';
    report += '<th style="text-align: left; padding: 8px; width: 20%;">Class Being Tested</th>\n';
    report += '<th style="text-align: left; padding: 8px; width: 12%;">Outcome</th>\n';
    report += '<th style="text-align: left; padding: 8px; width: 10%;">Per-Test Coverage</th>\n';
    report += '<th style="text-align: left; padding: 8px; width: 13%;">Runtime</th>\n';
    report += '</tr>\n';
    report += '</thead>\n';
    report += '<tbody>\n';
    for (const test of sortedTests) {
      const { fullClassName, testName } = getTestNameInfo(test);
      const outcome = test.outcome?.toString() ?? 'Unknown';
      const coverage = test.perClassCoverage?.[0]?.percentage ?? 'N/A';
      const coverageStr = typeof coverage === 'string' ? coverage : 'N/A';
      const runtime = test.runTime !== undefined ? formatDuration(test.runTime) : 'N/A';
      const outcomeEmoji = outcome === 'Pass' ? '✅' : outcome === 'Fail' ? '❌' : '⏭️';

      // Determine if this test needs highlighting
      const isSlow = isPoorlyPerforming(test.runTime, performanceThresholdMs);
      const hasLowCoverage = hasPoorCoverage(coverage, coverageThresholdPercent);

      // Row style (no background highlighting to maintain visibility)
      const rowStyle = 'border-bottom: 1px solid #ddd;';

      report += `<tr style="${rowStyle}">\n`;
      report += `<td style="padding: 8px;"><code>${escapeMarkdown(testName)}</code>`;
      if (isSlow || hasLowCoverage) {
        report += ' ⚠️';
      }
      report += '</td>\n';
      report += `<td style="padding: 8px;">${escapeMarkdown(fullClassName)}</td>\n`;
      report += `<td style="padding: 8px;">${outcomeEmoji} ${outcome}</td>\n`;

      // Highlight coverage cell if poor
      let coverageStyle = 'padding: 8px;';
      if (hasLowCoverage) {
        coverageStyle += ' font-weight: bold; color: #d32f2f;';
      }
      report += `<td style="${coverageStyle}">${coverageStr}</td>\n`;

      // Highlight runtime cell if slow
      let runtimeStyle = 'padding: 8px;';
      if (isSlow) {
        runtimeStyle += ' font-weight: bold; color: #d32f2f;';
      }
      report += `<td style="${runtimeStyle}">${runtime}</td>\n`;
      report += '</tr>\n';
    }
    report += '</tbody>\n';
    report += '</table>\n\n';
  }

  // Passed tests section
  const passedTests = result.tests?.filter(test => test.outcome?.toString() === 'Pass') ?? [];
  if (passedTests.length > 0) {
    const sortedPassedTests = sortTests(passedTests) ?? [];

    report += `## ✅ Passed Tests (${passedTests.length})\n\n`;
    for (const test of sortedPassedTests) {
      const { testName } = getTestNameInfo(test);

      const isSlow = isPoorlyPerforming(test.runTime, performanceThresholdMs);
      const hasLowCoverage =
        codeCoverage && hasPoorCoverage(test.perClassCoverage?.[0]?.percentage, coverageThresholdPercent);

      report += `- ${escapeMarkdown(testName)}`;
      if (test.runTime !== undefined) {
        const runtimeStr = formatDuration(test.runTime);
        report += isSlow ? ` (🐌 **${runtimeStr}** - slow)` : ` (${runtimeStr})`;
      }
      if (codeCoverage) {
        const coverage = test.perClassCoverage?.[0]?.percentage;
        if (coverage) {
          report += hasLowCoverage ? ` (📉 **${coverage}** coverage - low)` : ` - ${coverage} coverage`;
        }
      }
      report += '\n';
    }
    report += '\n';
  }

  // Skipped tests section
  const skippedTests = result.tests?.filter(test => test.outcome?.toString() === 'Skip') ?? [];
  if (skippedTests.length > 0) {
    report += `## ⏭️ Skipped Tests (${skippedTests.length})\n\n`;
    for (const test of skippedTests) {
      const { testName } = getTestNameInfo(test);

      report += `- ${escapeMarkdown(testName)}\n`;
    }
    report += '\n';
  }

  // Code coverage by class section
  if (codeCoverage && result.codecoverage && result.codecoverage.length > 0) {
    // Sort by coverage percentage ascending (lowest/worst first)
    const sortedCoverage = [...result.codecoverage].toSorted((a, b) => {
      const percentageA = getCoveragePercentage(a.percentage) ?? 0;
      const percentageB = getCoveragePercentage(b.percentage) ?? 0;
      return percentageA - percentageB; // Ascending order (lowest first)
    });

    report += '## Code Coverage by Class\n\n';
    report +=
      '*This section shows the overall code coverage for each class after all tests have run. This may differ from per-test coverage shown in the table above.*\n\n';
    report += '<table style="width: 100%; border-collapse: collapse;">\n';
    report += '<thead>\n';
    report += '<tr style="border-bottom: 2px solid;">\n';
    report += '<th style="text-align: left; padding: 8px; width: 30%;">Class</th>\n';
    report += '<th style="text-align: left; padding: 8px; width: 15%;">Coverage</th>\n';
    report += '<th style="text-align: left; padding: 8px; width: 55%;">Uncovered Lines</th>\n';
    report += '</tr>\n';
    report += '</thead>\n';
    report += '<tbody>\n';
    for (const coverageItem of sortedCoverage) {
      const className = coverageItem.name ?? 'Unknown';
      const percentage = coverageItem.percentage ?? '0%';
      const uncoveredLines = coverageItem.uncoveredLines ?? [];
      const uncoveredStr = uncoveredLines.length > 0 ? uncoveredLines.join(', ') : 'None';
      report += '<tr style="border-bottom: 1px solid #ddd;">\n';
      report += `<td style="padding: 8px;"><code>${escapeMarkdown(className)}</code></td>\n`;
      report += `<td style="padding: 8px;">${percentage}</td>\n`;
      report += `<td style="padding: 8px;">${uncoveredStr}</td>\n`;
      report += '</tr>\n';
    }
    report += '</tbody>\n';
    report += '</table>\n\n';
  }

  return report;
};

/** Generates a plain text report from test results */
export const generateTextReport = (result: TestResult, timestamp: Date, codeCoverage: boolean = false): string => {
  const { passed, failed, skipped, total, duration } = getSummaryInfo(result.summary);
  const timestampStr = formatTimestamp(timestamp);

  let report = 'Apex Test Results\n';
  report += '==================\n\n';
  report += `Run completed: ${timestampStr}\n\n`;

  // Summary
  report += 'Summary:\n';
  report += `  Passed:  ${passed}\n`;
  report += `  Failed:  ${failed}\n`;
  report += `  Skipped: ${skipped}\n`;
  report += `  Total:   ${total}\n`;
  report += `  Duration: ${formatDuration(duration)}\n\n`;

  // Failures section
  const failedTests = result.tests?.filter(test => test.outcome?.toString() === 'Fail') ?? [];
  if (failedTests.length > 0) {
    report += 'Failures:\n';
    report += '=========\n\n';
    for (const test of failedTests) {
      const { testName } = getTestNameInfo(test);

      report += `${testName}\n`;
      report += `${'-'.repeat(testName.length)}\n`;
      if (test.message) {
        report += `Error:\n${test.message}\n\n`;
      }
      if (test.stackTrace) {
        report += `Stack Trace:\n${test.stackTrace}\n\n`;
      }
      if (test.runTime !== undefined) {
        report += `Duration: ${formatDuration(test.runTime)}\n\n`;
      }
      report += '\n';
    }
  }

  // Passed tests section
  const passedTests = result.tests?.filter(test => test.outcome?.toString() === 'Pass') ?? [];
  if (passedTests.length > 0) {
    report += 'Passed Tests:\n';
    report += '==============\n\n';
    for (const test of passedTests) {
      const { testName } = getTestNameInfo(test);

      report += `  - ${testName}`;
      if (test.runTime !== undefined) {
        report += ` (${formatDuration(test.runTime)})`;
      }
      report += '\n';
    }
    report += '\n';
  }

  // Skipped tests section
  const skippedTests = result.tests?.filter(test => test.outcome?.toString() === 'Skip') ?? [];
  if (skippedTests.length > 0) {
    report += 'Skipped Tests:\n';
    report += '===============\n\n';
    for (const test of skippedTests) {
      const { testName } = getTestNameInfo(test);

      report += `  - ${testName}\n`;
    }
    report += '\n';
  }

  // Code coverage by class section
  if (codeCoverage && result.codecoverage && result.codecoverage.length > 0) {
    report += 'Code Coverage by Class:\n';
    report += '=======================\n\n';
    for (const coverageItem of result.codecoverage) {
      const className = coverageItem.name ?? 'Unknown';
      const percentage = coverageItem.percentage ?? '0%';
      const uncoveredLines = coverageItem.uncoveredLines ?? [];
      const uncoveredStr = uncoveredLines.length > 0 ? uncoveredLines.join(', ') : 'None';
      report += `  ${className}: ${percentage} (Uncovered: ${uncoveredStr})\n`;
    }
    report += '\n';
  }

  return report;
};

/** Generates a filename with timestamp to preserve previous runs */
const generateReportFilename = (outputDir: string, extension: string): string => {
  const timestamp = new Date();
  const year = timestamp.getFullYear();
  const month = String(timestamp.getMonth() + 1).padStart(2, '0');
  const day = String(timestamp.getDate()).padStart(2, '0');
  const hour = String(timestamp.getHours()).padStart(2, '0');
  const minute = String(timestamp.getMinutes()).padStart(2, '0');
  const second = String(timestamp.getSeconds()).padStart(2, '0');
  const timestampStr = `${year}${month}${day}-${hour}${minute}${second}`;
  return path.join(outputDir, `test-results-${timestampStr}${extension}`);
};

/** Writes test report to file and opens it in editor */
export const writeAndOpenTestReport = async (
  result: TestResult,
  outputDir: string,
  format: OutputFormat,
  codeCoverage: boolean = false,
  sortOrder: TestSortOrder = 'runtime'
): Promise<string> => {
  const timestamp = new Date();
  const reportContent =
    format === 'markdown'
      ? generateMarkdownReport(result, timestamp, codeCoverage, sortOrder)
      : generateTextReport(result, timestamp, codeCoverage);

  // Generate filename with timestamp to preserve previous runs
  const extension = format === 'markdown' ? '.md' : '.txt';
  const reportPath = generateReportFilename(outputDir, extension);

  // Ensure content uses LF line endings (UTF-8 with LF)
  const normalizedContent = reportContent.replaceAll('\r\n', '\n').replaceAll('\r', '\n');

  // Write file using vscode.workspace.fs
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(normalizedContent);
  const uri = vscode.Uri.file(reportPath);
  await vscode.workspace.fs.writeFile(uri, uint8Array);

  // Open the markdown preview automatically for markdown files
  if (format === 'markdown') {
    // Try to refresh the preview if it's already open (before opening a new one)
    try {
      await vscode.commands.executeCommand('markdown.preview.refresh');
    } catch {
      // Preview refresh command might not be available, ignore
    }
    // Then show the preview
    await vscode.commands.executeCommand('markdown.showPreview', uri);
  } else {
    // For text files, just open the document
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, {
      preview: false,
      preserveFocus: false
    });
  }

  return reportPath;
};
