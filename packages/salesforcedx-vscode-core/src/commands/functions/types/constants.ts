/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { GlobPattern } from 'vscode';

/**
 * Functions Payload pattern
 */
export const FUNCTION_PAYLOAD_PATTERN: GlobPattern =
  '**/functions/**/*.json';
/**
 * Functions payload document selector
 */
export const FUNCTION_PAYLOAD_DOCUMENT_SELECTOR = {
  language: 'json',
  pattern: FUNCTION_PAYLOAD_PATTERN
};
