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
 * Extracts a file/line/column location from the first Jest stack trace line found in `text`.
 */
export const matchJestStackTraceLocation = (
  text: string
): { file: string; line: number; column: number } | undefined => {
  const match = text.match(JEST_STACK_TRACE_PATTERN);
  if (!match) {
    return undefined;
  }
  const file = match[1] ?? match[4];
  const line = match[2] ?? match[5];
  const column = match[3] ?? match[6];
  return { file, line: parseInt(line, 10), column: parseInt(column, 10) };
};
