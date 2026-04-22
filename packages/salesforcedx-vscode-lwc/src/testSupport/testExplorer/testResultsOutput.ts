/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { nls } from '../../messages';
import { LwcJestTestAssertionResult, LwcJestTestResults } from '../types';

// VS Code's Test Results panel is an xterm, so we drive it with ANSI SGR codes
// to emit a Jest-style report (colored PASS/FAIL badges, dim file paths with
// bold filenames, describe-tree indentation, colored status glyphs). Every
// line ends with \r\n because xterm treats LF alone as a cursor-down without
// a carriage return.

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  whiteFg: '\x1b[97m'
} as const;

const SEPARATOR = `${ANSI.dim}${'━'.repeat(60)}${ANSI.reset}`;
const PASS_BADGE = `${ANSI.bold}${ANSI.bgGreen}${ANSI.whiteFg} PASS ${ANSI.reset}`;
const FAIL_BADGE = `${ANSI.bold}${ANSI.bgRed}${ANSI.whiteFg} FAIL ${ANSI.reset}`;
const CHECK = `${ANSI.green}✓${ANSI.reset}`;
const CROSS = `${ANSI.red}✗${ANSI.reset}`;
const CIRCLE = `${ANSI.yellow}○${ANSI.reset}`;

/**
 * Contract for finding TestItems that correspond to a Jest result. The
 * LwcTestController provides this so this module stays ignorant of the
 * controller's internal ID scheme while still being able to attach output
 * lines to the right TestItem (which is what makes clicking a failure in
 * the Test Results tree scroll to the relevant output).
 */
export type TestItemLookup = {
  findFileItem: (testUri: URI) => vscode.TestItem | undefined;
  findCaseItem: (
    testUri: URI,
    title: string,
    ancestorTitles: string[] | undefined
  ) => vscode.TestItem | undefined;
};

/** Bold cyan profile title between dim horizontal rules — written once at the start of each test run. */
export const appendRunHeader = (run: vscode.TestRun, isDebug: boolean): void => {
  const title = isDebug
    ? nls.localize('lwc_test_debug_profile_title')
    : nls.localize('lwc_test_run_profile_title');
  run.appendOutput(toCrlf(SEPARATOR));
  run.appendOutput(toCrlf(`  ${ANSI.bold}${ANSI.cyan}${title}${ANSI.reset}`));
  run.appendOutput(toCrlf(SEPARATOR));
  run.appendOutput('\r\n');
};

/**
 * Write a Jest-style per-file report to VS Code's Test Results tab: colored PASS/FAIL badge + pretty path per
 * file; assertions grouped under their describe() blocks with tree indentation; colored check/cross glyphs,
 * per-test durations, inline failure messages; a colored summary block at the end (suites, tests, time).
 */
export const appendTestResultsOutput = (
  run: vscode.TestRun,
  results: LwcJestTestResults,
  lookup: TestItemLookup
): void => {
  for (const fileResult of results.testResults) {
    const testUri = URI.file(fileResult.name);
    const relPath = toRelativePath(fileResult.name);
    const fileDurationMs = Math.max(0, fileResult.endTime - fileResult.startTime);
    const durationSuffix =
      fileDurationMs > 0 ? ` ${ANSI.gray}(${formatDuration(fileDurationMs)})${ANSI.reset}` : '';
    run.appendOutput(toCrlf(`${fileBadge(fileResult.status)}  ${formatPrettyPath(relPath)}${durationSuffix}`));

    const fileItem = lookup.findFileItem(testUri);
    const tree = buildDescribeTree(fileResult.assertionResults);
    renderDescribeNode(run, testUri, tree, 1, fileItem, lookup);
    run.appendOutput('\r\n');
  }

  run.appendOutput(toCrlf(SEPARATOR));
  run.appendOutput(
    toCrlf(
      formatSummaryLine(
        'Test Suites:',
        results.numPassedTestSuites,
        results.numFailedTestSuites,
        results.numTotalTestSuites,
        results.numPendingTestSuites
      )
    )
  );
  run.appendOutput(
    toCrlf(
      formatSummaryLine(
        'Tests:',
        results.numPassedTests,
        results.numFailedTests,
        results.numTotalTests,
        results.numPendingTests
      )
    )
  );
  const totalMs = computeTotalWallClockMs(results);
  if (totalMs > 0) {
    run.appendOutput(toCrlf(`  ${ANSI.bold}${'Time:'.padEnd(13)}${ANSI.reset} ${formatDuration(totalMs)}`));
  }
  run.appendOutput(toCrlf(SEPARATOR));
  run.appendOutput('\r\n');
};

/** Append a single line to `run` as xterm-friendly output (\r\n terminated). */
export const appendLine = (run: vscode.TestRun, line: string): void => {
  run.appendOutput(toCrlf(line));
};

const toCrlf = (line: string): string => `${line}\r\n`;

const fileBadge = (status: 'passed' | 'failed'): string => (status === 'passed' ? PASS_BADGE : FAIL_BADGE);

const assertionGlyph = (status: string): string => {
  if (status === 'passed') {
    return CHECK;
  }
  if (status === 'failed') {
    return CROSS;
  }
  return CIRCLE;
};

const formatAssertionLabel = (title: string, status: string, duration: number | undefined): string => {
  const name = status === 'failed' ? `${ANSI.red}${title}${ANSI.reset}` : title;
  if (duration != null && duration >= 1) {
    return `${name} ${ANSI.gray}(${formatDuration(duration)})${ANSI.reset}`;
  }
  return name;
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }
  return `${(ms / 1000).toFixed(2)} s`;
};

const formatPrettyPath = (relPath: string): string => {
  const idx = Math.max(relPath.lastIndexOf('/'), relPath.lastIndexOf('\\'));
  if (idx < 0) {
    return `${ANSI.bold}${relPath}${ANSI.reset}`;
  }
  const dir = relPath.slice(0, idx + 1);
  const file = relPath.slice(idx + 1);
  return `${ANSI.dim}${dir}${ANSI.reset}${ANSI.bold}${file}${ANSI.reset}`;
};

const formatSummaryLine = (
  label: string,
  passed: number,
  failed: number,
  total: number,
  pending: number
): string => {
  const parts: string[] = [];
  if (failed > 0) {
    parts.push(`${ANSI.red}${ANSI.bold}${failed} failed${ANSI.reset}`);
  }
  if (passed > 0) {
    parts.push(`${ANSI.green}${ANSI.bold}${passed} passed${ANSI.reset}`);
  }
  if (pending > 0) {
    parts.push(`${ANSI.yellow}${ANSI.bold}${pending} pending${ANSI.reset}`);
  }
  parts.push(`${total} total`);
  return `  ${ANSI.bold}${label.padEnd(13)}${ANSI.reset} ${parts.join(', ')}`;
};

const toRelativePath = (filePath: string): string => {
  const folder = vscode.workspace.getWorkspaceFolder(URI.file(filePath));
  if (!folder) {
    return filePath;
  }
  const rootFs = folder.uri.fsPath;
  if (filePath.startsWith(rootFs)) {
    const rest = filePath.slice(rootFs.length);
    return rest.startsWith('/') || rest.startsWith('\\') ? rest.slice(1) : rest;
  }
  return filePath;
};

/**
 * Approximates Jest's wall-clock time by spanning the earliest file startTime
 * to the latest endTime — files run in parallel, so summing per-file durations
 * would overcount.
 */
const computeTotalWallClockMs = (results: LwcJestTestResults): number => {
  if (!results.testResults || results.testResults.length === 0) {
    return 0;
  }
  let earliestStart = Number.POSITIVE_INFINITY;
  let latestEnd = Number.NEGATIVE_INFINITY;
  for (const fileResult of results.testResults) {
    if (fileResult.startTime < earliestStart) {
      earliestStart = fileResult.startTime;
    }
    if (fileResult.endTime > latestEnd) {
      latestEnd = fileResult.endTime;
    }
  }
  if (!Number.isFinite(earliestStart) || !Number.isFinite(latestEnd)) {
    return 0;
  }
  return Math.max(0, latestEnd - earliestStart);
};

type DescribeNode = {
  name: string;
  children: Map<string, DescribeNode>;
  tests: LwcJestTestAssertionResult[];
};

/**
 * Builds a describe-block tree from a flat list of Jest assertions keyed by
 * their `ancestorTitles` path, preserving the original assertion order so
 * tests appear in the same order Jest reported them.
 */
const buildDescribeTree = (assertions: readonly LwcJestTestAssertionResult[]): DescribeNode => {
  const root: DescribeNode = { name: '', children: new Map(), tests: [] };
  for (const assertion of assertions) {
    let node = root;
    for (const title of assertion.ancestorTitles ?? []) {
      let child = node.children.get(title);
      if (!child) {
        child = { name: title, children: new Map(), tests: [] };
        node.children.set(title, child);
      }
      node = child;
    }
    node.tests.push(assertion);
  }
  return root;
};

/** Recursively render a describe-block tree, indenting children and coloring the describe titles. */
const renderDescribeNode = (
  run: vscode.TestRun,
  testUri: URI,
  node: DescribeNode,
  depth: number,
  fileItem: vscode.TestItem | undefined,
  lookup: TestItemLookup
): void => {
  const pad = '  '.repeat(depth);
  for (const assertion of node.tests) {
    const caseItem = lookup.findCaseItem(testUri, assertion.title, assertion.ancestorTitles);
    const glyph = assertionGlyph(assertion.status);
    const label = formatAssertionLabel(assertion.title, assertion.status, assertion.duration);
    run.appendOutput(toCrlf(`${pad}${glyph} ${label}`), undefined, caseItem);

    if (assertion.status === 'failed' && assertion.failureMessages?.length) {
      const detailPad = `${pad}   `;
      const detail = assertion.failureMessages
        .join('\n')
        .split('\n')
        .map(line => `${detailPad}${ANSI.red}${line}${ANSI.reset}`)
        .join('\r\n');
      run.appendOutput(`${detail}\r\n`, undefined, caseItem ?? fileItem);
    }
  }

  for (const child of node.children.values()) {
    run.appendOutput(toCrlf(`${pad}${ANSI.cyan}${child.name}${ANSI.reset}`));
    renderDescribeNode(run, testUri, child, depth + 1, fileItem, lookup);
  }
};
