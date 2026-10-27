/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { NamespaceInfo } from '../tests/types';
import type { Connection } from '@salesforce/core';
import * as Array from 'effect/Array';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { queryRecords } from './records';
import { InstalledSubscriberPackageRecordSchema, NamespacePrefixRecordSchema } from './schema/wire/namespaces';

type NsPrefixRecord = typeof NamespacePrefixRecordSchema.Type;

const emptyNsRecords: readonly NsPrefixRecord[] = [];

const installedSubscriberNsRecords = (connection: Connection) =>
  queryRecords(
    connection,
    'queryNamespaces',
    'SELECT SubscriberPackage.NamespacePrefix FROM InstalledSubscriberPackage',
    InstalledSubscriberPackageRecordSchema,
    true
  ).pipe(Effect.map(records => records.map(record => record.SubscriberPackage)));

const installedNsRecords = (connection: Connection) =>
  queryRecords(
    connection,
    'queryNamespaces',
    'SELECT NamespacePrefix FROM PackageLicense',
    NamespacePrefixRecordSchema
  ).pipe(
    Effect.catchTags({
      ApexOperationError: () => installedSubscriberNsRecords(connection),
      ApexResponseDecodeError: () => installedSubscriberNsRecords(connection)
    }),
    Effect.catchTags({
      ApexOperationError: () => Effect.succeed(emptyNsRecords),
      ApexResponseDecodeError: () => Effect.succeed(emptyNsRecords)
    })
  );

const orgNsRecords = (connection: Connection) =>
  queryRecords(
    connection,
    'queryNamespaces',
    'SELECT NamespacePrefix FROM Organization',
    NamespacePrefixRecordSchema
  ).pipe(
    Effect.catchTags({
      ApexOperationError: () => Effect.succeed(emptyNsRecords),
      ApexResponseDecodeError: () => Effect.succeed(emptyNsRecords)
    })
  );

const toNamespaceInfo =
  (installedNs: boolean) =>
  (record: NsPrefixRecord): Option.Option<NamespaceInfo> =>
    record.NamespacePrefix.pipe(Option.map(namespace => ({ installedNs, namespace })));

/** Namespace discovery is optional; inaccessible queries must not prevent test selection. */
export const queryNamespaces = Effect.fn('Apex.queryNamespaces')(function* (connection: Connection) {
  return yield* Effect.all([installedNsRecords(connection), orgNsRecords(connection)], {
    concurrency: 'unbounded'
  }).pipe(
    Effect.map(([installedRecords, orgRecords]) => [
      ...Array.filterMap(orgRecords, toNamespaceInfo(false)),
      ...Array.filterMap(installedRecords, toNamespaceInfo(true))
    ])
  );
});
