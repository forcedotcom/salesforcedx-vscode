/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CLASS_ID_PREFIX, TEST_RUN_ID_PREFIX } from './constants';

export function isValidTestRunID(testRunId: string): boolean {
  return (
    (testRunId.length === 15 || testRunId.length === 18) &&
    testRunId.startsWith(TEST_RUN_ID_PREFIX)
  );
}

export function isValidApexClassID(apexClassId: string): boolean {
  return (
    (apexClassId.length === 15 || apexClassId.length === 18) &&
    apexClassId.startsWith(CLASS_ID_PREFIX)
  );
}
