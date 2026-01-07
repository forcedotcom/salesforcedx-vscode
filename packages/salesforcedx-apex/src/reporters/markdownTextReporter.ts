/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TestResult, ApexTestResultData } from '../tests/types';

export type OutputFormat = 'markdown' | 'text';
export type TestSortOrder = 'runtime' | 'coverage' | 'severity';

export interface MarkdownTextReporterOptions {
  /**
   * Output format: 'markdown' or 'text'
   */
  format?: OutputFormat;
  /**
   * Sort order for tests: 'runtime', 'coverage', or 'severity'
   */
  sortOrder?: TestSortOrder;
  /**
   * Performance threshold in milliseconds. Tests exceeding this will be flagged as poorly performing.
   */
  performanceThresholdMs?: number;
  /**
   * Coverage threshold as a percentage. Tests below this will be flagged as poorly covered.
   */
  coverageThresholdPercent?: number;
  /**
   * Whether to include code coverage information in the report
   */
  codeCoverage?: boolean;
  /**
   * Timestamp for the test run. If not provided, current time will be used.
   */
  timestamp?: Date;
}

/** Escapes markdown special characters */
export const escapeMarkdown = (text: string): string =>
  text.replaceAll(/[\\`*_{}[\]()#+\-!]/g, '\\$&');

/** Formats duration in milliseconds to a human-readable string */
export const formatDuration = (ms: number): string => {
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
export const isPoorlyPerforming = (
  runTime: number | undefined,
  thresholdMs: number
): boolean => runTime !== undefined && runTime > thresholdMs;

/** Checks if a test has poor coverage */
export const hasPoorCoverage = (
  coverage: string | number | undefined,
  thresholdPercent: number
): boolean => {
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
export const getCoveragePercentage = (
  coverage?: string | number
): number | null => {
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
export const getTestNameInfo = (test: ApexTestResultData) => {
  const className = test.apexClass?.name ?? 'Unknown';
  const namespacePrefix = test.apexClass?.namespacePrefix;
  const fullClassName = namespacePrefix
    ? `${namespacePrefix}.${className}`
    : className;
  const methodName = test.methodName ?? 'Unknown';
  const testName = `${fullClassName}.${methodName}`;
  return { className, namespacePrefix, fullClassName, methodName, testName };
};

/** Formats timestamp to a string */
export const formatTimestamp = (timestamp: Date): string =>
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
export const getSummaryInfo = (summary: TestResult['summary']) => {
  const passed = summary?.passing ?? 0;
  const failed = summary?.failing ?? 0;
  const skipped = summary?.skipped ?? 0;
  const total = summary?.testsRan ?? 0;
  const duration =
    summary?.outcome === 'Passed' || summary?.outcome === 'Failed'
      ? (summary?.testExecutionTimeInMs ?? 0)
      : 0;
  return { passed, failed, skipped, total, duration };
};

/** Calculates a severity score for sorting (higher = worse) */
export const getSeverityScore = (
  test: ApexTestResultData,
  codeCoverage: boolean,
  performanceThresholdMs: number,
  coverageThresholdPercent: number
): number => {
  let score = 0;

  // Both issues = highest priority (score 10000+)
  const isSlow = isPoorlyPerforming(test.runTime, performanceThresholdMs);
  const hasLowCoverage =
    codeCoverage &&
    hasPoorCoverage(
      test.perClassCoverage?.[0]?.percentage,
      coverageThresholdPercent
    );

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
    const coverage = getCoveragePercentage(
      test.perClassCoverage?.[0]?.percentage
    );
    if (coverage !== null) {
      score += (100 - coverage) * 100; // Lower coverage = higher score
    }
  }

  return score;
};
