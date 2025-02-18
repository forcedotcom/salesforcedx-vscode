/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export const PROMPT_TOKEN_MAX_LIMIT = 14 * 1024;
export const RESPONSE_TOKEN_MAX_LIMIT = 2 * 1024;
export const SUM_TOKEN_MAX_LIMIT = PROMPT_TOKEN_MAX_LIMIT + RESPONSE_TOKEN_MAX_LIMIT;
export const IMPOSED_FACTOR = 0.95;
