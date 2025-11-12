/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export type ToolingTestMethod = {
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
