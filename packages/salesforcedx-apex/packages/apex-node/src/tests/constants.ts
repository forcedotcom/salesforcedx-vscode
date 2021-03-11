/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Tooling API query char limit is 100,000 after v48; REST API limit for uri + headers is 16,348 bytes
// local testing shows query char limit to be closer to ~12,400
export const QUERY_CHAR_LIMIT = 12400;
export const CLASS_ID_PREFIX = '01p';
export const TEST_RUN_ID_PREFIX = '707';
