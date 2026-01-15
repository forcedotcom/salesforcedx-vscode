/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// orgs can be flaky about this, especially wnen tests on the same org are running in parallel and get queued up.
export const RETRIEVE_TIMEOUT_MS = 600_000;
