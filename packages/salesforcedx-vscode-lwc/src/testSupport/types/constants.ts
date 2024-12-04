/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { GlobPattern } from 'vscode';

/**
 * SFDX Project JSON glob pattern
 */
export const SFDX_PROJECT_JSON_GLOB_PATTERN: GlobPattern = '**/sfdx-project.json';
/**
 * LWC Jest Test glob pattern
 */
export const LWC_TEST_GLOB_PATTERN: GlobPattern = '**/{lwc,modules}/**/*.test.js';
/**
 * LWC Jest Test document selector
 */
export const LWC_TEST_DOCUMENT_SELECTOR = {
  language: 'javascript',
  pattern: LWC_TEST_GLOB_PATTERN
};
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
