/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable jsdoc/check-indentation */

type ToolingTestMethod = {
  name: string;
  line?: number;
  column?: number;
};

// Single authoritative shape for test classes (matches Tooling REST response)
export type ToolingTestClass = {
  id: string; // may be "" for some flow tests
  name: string;
  // For Apex tests this is "" (default) or a namespace; for flow tests it follows "FlowTesting[.Namespace]"
  namespacePrefix: string;
  testMethods: ToolingTestMethod[];
};

export type TestDiscoveryResult = {
  classes: ToolingTestClass[];
};

// Tooling REST /tooling/tests response types
export type ToolingTestsPage = {
  apexTestClasses: ToolingTestClass[]; // [] if none
  size: number;
  nextRecordsUrl: string | null;
  testSetSignature: string;
  message: string | null;
};

/**
 * Options for discovering tests via the Tooling API
 * - showAllMethods: If true, returns all test methods (not just @TestSetup);
 *   if false or omitted, returns only @TestSetup methods.
 * - namespacePrefix:
 *   - Omit (undefined) to retrieve tests in all namespaces (Apex and Flow).
 *   - Use 'FlowTesting' or 'FlowTesting.<Namespace>' to filter to flow tests (per docs).
 *   - Use '<Namespace>' to filter to a specific Apex namespace.
 *   - Supplying '' (empty string) is treated as omitted by this client and won't be sent.
 * - pageSize:
 *   - Number of classes per page; remote default is 1000; maximum 10000.
 */
export type DiscoverTestsOptions = {
  showAllMethods?: boolean;
  namespacePrefix?: string;
  pageSize?: number;
};
