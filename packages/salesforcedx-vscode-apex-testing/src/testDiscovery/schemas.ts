/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable jsdoc/check-indentation */

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

/** Package2.ContainerOptions discriminates Unlocked vs Managed packages (see Skyline sfCli.ts). */
export const ContainerOption = Schema.Literal('Unlocked', 'Managed');
export type ContainerOption = Schema.Schema.Type<typeof ContainerOption>;

/**
 * Resolved owning-package info for an ApexClass. `containerOptions` none = 1GP/unknown; some drives the
 * "(Unlocked)"/managed label suffix. namespacePrefix intentionally absent: the tree reads namespace from the
 * discovered ToolingTestClass, never from here.
 */
export const ResolvedPackageInfo = Schema.Struct({
  package2Id: Schema.String,
  packageName: Schema.String,
  containerOptions: Schema.Option(ContainerOption)
});
export type ResolvedPackageInfo = Schema.Schema.Type<typeof ResolvedPackageInfo>;

/**
 * Package2 Tooling row (decode boundary). Id/Name/SubscriberPackageId required so decoded rows need no
 * null-guards; ContainerOptions maps null/absent ⇄ Option and rejects values outside the literal union.
 */
export const Package2Row = Schema.Struct({
  Id: Schema.String,
  Name: Schema.String,
  SubscriberPackageId: Schema.String,
  ContainerOptions: Schema.optionalWith(ContainerOption, { as: 'Option', nullable: true })
});
export type Package2Row = Schema.Schema.Type<typeof Package2Row>;

/** Package2Member Tooling row (decode boundary). SubjectId = packaged component Id; SubscriberPackageId = join key. */
export const Package2MemberRow = Schema.Struct({
  SubjectId: Schema.String,
  SubscriberPackageId: Schema.String
});
export type Package2MemberRow = Schema.Schema.Type<typeof Package2MemberRow>;

/**
 * InstalledSubscriberPackage Tooling row (subscriber-org fallback). NamespacePrefix stays a raw optional
 * string here (accepts `''`); the resolver trims-then-Options it so empty ⇄ no-namespace like `null`/absent.
 */
export const InstalledSubscriberPackageRow = Schema.Struct({
  SubscriberPackageId: Schema.String,
  SubscriberPackage: Schema.Struct({
    Name: Schema.String,
    NamespacePrefix: Schema.optionalWith(Schema.String, { as: 'Option', nullable: true })
  })
});
export type InstalledSubscriberPackageRow = Schema.Schema.Type<typeof InstalledSubscriberPackageRow>;

/** ApexClass ManageableState row (unpackaged detection for the single no-namespace package). */
export const ApexClassManageableStateRow = Schema.Struct({
  Id: Schema.String,
  ManageableState: Schema.optionalWith(Schema.String, { as: 'Option', nullable: true })
});
export type ApexClassManageableStateRow = Schema.Schema.Type<typeof ApexClassManageableStateRow>;
