/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const PASS_RESULT = 'Pass';
export const FAIL_RESULT = 'Fail';
export const SKIP_RESULT = 'Skip';
export const APEX_CLASS_EXT = '.cls';
export const APEX_TESTSUITE_EXT = '.testSuite-meta.xml';
export const IS_TEST_REG_EXP = /@isTest/i;

// Test item ID prefixes
export const TEST_ID_PREFIXES = {
  SUITE: 'suite:',
  CLASS: 'class:',
  METHOD: 'method:',
  SUITE_CLASS: 'suite-class:',
  NAMESPACE: 'namespace:',
  PACKAGE: 'package:'
} as const;

export const SUITE_PARENT_ID = 'apex-test-suites-parent';

/** Namespace key for classes with no namespace (Local Namespace) */
export const LOCAL_NAMESPACE_KEY = 'local';

/** Package key for unpackaged metadata under Local Namespace */
export const UNPACKAGED_PACKAGE_KEY = 'unpackaged';

/** Test item ID for the (Unpackaged Metadata) container */
export const UNPACKAGED_PACKAGE_ID = 'package:local:unpackaged';
