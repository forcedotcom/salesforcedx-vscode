/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { GlobPattern } from 'vscode';

export const SFDX_PROJECT_JSON_GLOB_PATTERN: GlobPattern =
  '**/sfdx-project.json';
export const LWC_TEST_GLOB_PATTERN: GlobPattern = '**/lwc/**/*.test.js';
export const LWC_TEST_DOCUMENT_SELECTOR = {
  language: 'javascript',
  pattern: LWC_TEST_GLOB_PATTERN
};
export const SFDX_LWC_JEST_FILE_FOCUSED_CONTEXT = 'sfdx:lwc_jest_file_focused';
export const SFDX_LWC_JEST_IS_WATCHING_FOCUSED_FILE_CONTEXT =
  'sfdx:lwc_jest_is_watching_focused_file';
