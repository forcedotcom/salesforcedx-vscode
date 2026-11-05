/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

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
  passedTests: {
    testName: string;
    runtime?: string;
    coverage?: string;
    isSlow: boolean;
    hasLowCoverage: boolean;
  }[];
  skippedTests: {
    testName: string;
  }[];
  coverageTable?: {
    rows: CoverageTableRow[];
    note?: string;
  };
}
