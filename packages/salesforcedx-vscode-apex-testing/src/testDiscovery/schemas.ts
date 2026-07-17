/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable jsdoc/check-indentation */

import type { Package2Member } from '@salesforce/types/tooling';
import * as Schema from 'effect/Schema';

const ToolingTestMethod = Schema.Struct({
  name: Schema.String,
  line: Schema.optional(Schema.Number),
  column: Schema.optional(Schema.Number)
});

/**
 * Normalized domain test class. `OptionFromNonEmptyTrimmedString` maps the wire `""` sentinel ⇄
 * `Option<string>` at the parse boundary. `id` absent (some flow tests) = `Option.none`; `namespacePrefix`
 * none = default Apex namespace, `Option.some('FlowTesting[.Namespace]')` = flow test.
 */
export const ToolingTestClass = Schema.Struct({
  id: Schema.OptionFromNonEmptyTrimmedString,
  name: Schema.String,
  namespacePrefix: Schema.OptionFromNonEmptyTrimmedString,
  testMethods: Schema.Array(ToolingTestMethod)
});
export type ToolingTestClass = Schema.Schema.Type<typeof ToolingTestClass>;

/** Raw Tooling REST shape (pre-decode): `id`/`namespacePrefix` are plain strings, possibly `""`. */
type ToolingTestClassWire = Schema.Schema.Encoded<typeof ToolingTestClass>;

export type TestDiscoveryResult = {
  classes: ToolingTestClass[];
};

// Tooling REST /tooling/tests response types
export type ToolingTestsPage = {
  apexTestClasses: ToolingTestClassWire[]; // [] if none
  size: number;
  nextRecordsUrl: string | null;
  testSetSignature: string;
  message: string | null;
};

/**
 * Options for discovering tests via the Tooling API
 * - namespacePrefix:
 *   - Omit (undefined) to retrieve tests in all namespaces (Apex and Flow).
 *   - Use 'FlowTesting' or 'FlowTesting.<Namespace>' to filter to flow tests (per docs).
 *   - Use '<Namespace>' to filter to a specific Apex namespace.
 *   - Supplying '' (empty string) is treated as omitted by this client and won't be sent.
 */
export type DiscoverTestsOptions = {
  namespacePrefix?: string;
};

/** Package2Member (WSDL-generated, @salesforce/types). Resolution uses SubjectId + SubscriberPackageId. */
export type Package2MemberRecord = Package2Member;

export type ResolvedPackageInfo = {
  package2Id: string;
  packageName: string;
  namespacePrefix: string | null;
  /** When present, e.g. 'Unlocked' or 'Managed' (from Package2.ContainerOptions) */
  containerOptions?: string;
};
