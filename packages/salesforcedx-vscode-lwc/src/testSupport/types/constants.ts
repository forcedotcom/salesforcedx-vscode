/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { GlobPattern } from 'vscode';

/**
 * LWC Jest Test glob pattern
 */
export const LWC_TEST_GLOB_PATTERN: GlobPattern = '**/{lwc,modules}/**/*.test.{js,ts}';
/**
 * LWC Jest Test document selector
 */
export const LWC_TEST_DOCUMENT_SELECTOR = [
  { language: 'javascript', pattern: '**/{lwc,modules}/**/*.test.js' as const },
  { language: 'typescript', pattern: '**/{lwc,modules}/**/*.test.ts' as const }
];
/**
 * Context when LWC Jest Test file is focused
 */
export const SF_LWC_JEST_FILE_FOCUSED_CONTEXT = 'sf:lwc_jest_file_focused';
/**
 * Context when LWC Jest Test file is focused and user is currently watching the test
 */
export const SF_LWC_JEST_IS_WATCHING_FOCUSED_FILE_CONTEXT = 'sf:lwc_jest_is_watching_focused_file';

/**
 * Run LWC test telemetry log name
 */
export const LWC_TEST_RUN_LOG_NAME = 'lwc_test_run_action';
/**
 * Debug LWC test telemetry log name
 */
export const LWC_TEST_DEBUG_LOG_NAME = 'lwc_test_debug_action';
/**
 * Watch LWC test telemetry log name
 */
export const LWC_TEST_WATCH_LOG_NAME = 'lwc_test_watch_action';
/**
 * GlobalState key for dismissing the Jest Runner duplicate code lens notification
 */
export const LWC_JEST_RUNNER_DUPLICATE_LENS_NOTICE_DISMISSED = 'lwc.jestRunnerDuplicateLensNoticeDismissed';

/**
 * Pattern to extract file location from Jest stack traces.
 * Matches "at SomeFunction (/path/to/file.js:123:45)" (groups 1-3) or the unparenthesized
 * "at /path/to/file.js:123:45" (groups 4-6) as mutually exclusive alternatives, anchored to
 * end-of-line ($/m). This lets the path itself contain literal parentheses (e.g. a "Program
 * Files (x86)" directory) without being confused for the function-name delimiter — a single
 * optional non-capturing group can't disambiguate that case. Use matchJestStackTraceLocation
 * rather than matching against this directly.
 */
const JEST_STACK_TRACE_PATTERN = /at (?:.*?\((.+):(\d+):(\d+)\)|(.+):(\d+):(\d+))$/m;

/**
 * Extracts file/line/column location from Jest stack trace lines in `text`.
 * Prefers test files (`__tests__/` or `.test.[jt]sx?`) over other user code.
 * Skips `node_modules` frames entirely. Falls back to first non-node_modules frame,
 * then first match if all frames are in node_modules.
 */
export const matchJestStackTraceLocation = (
  text: string
): { file: string; line: number; column: number } | undefined => {
  const globalPattern = new RegExp(JEST_STACK_TRACE_PATTERN.source, 'gm');
  const matches = [...text.matchAll(globalPattern)];

  if (matches.length === 0) {
    return undefined;
  }

  // Prefer test files over source files, and skip node_modules entirely
  let firstNonNodeModules: { file: string; line: number; column: number } | undefined;

  for (const match of matches) {
    const filePath = match[1] ?? match[4];
    if (filePath.includes('node_modules')) {
      continue;
    }

    const lineNum = match[2] ?? match[5];
    const colNum = match[3] ?? match[6];
    const location = { file: filePath, line: parseInt(lineNum, 10), column: parseInt(colNum, 10) };

    // Prefer test files (__tests__/ or .test.js/.test.ts)
    if (filePath.includes('__tests__') || /\.test\.[jt]sx?$/.test(filePath)) {
      return location;
    }

    // Remember first non-node_modules as fallback
    firstNonNodeModules ??= location;
  }

  // Return first non-node_modules if no test file found
  if (firstNonNodeModules) {
    return firstNonNodeModules;
  }

  // Fallback to first match if all are in node_modules
  const firstMatch = matches[0];
  const file = firstMatch[1] ?? firstMatch[4];
  const line = firstMatch[2] ?? firstMatch[5];
  const column = firstMatch[3] ?? firstMatch[6];
  return { file, line: parseInt(line, 10), column: parseInt(column, 10) };
};
