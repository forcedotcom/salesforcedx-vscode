/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { NamespaceInfo } from '../tests/types';
import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import { isError } from 'effect/Predicate';
import { NamespaceQueryError } from './schema/errors';

type NsPrefixRecord = { NamespacePrefix: string };
type InstalledSubscriberRecord = { SubscriberPackage: NsPrefixRecord };

const emptyNsRecords: readonly NsPrefixRecord[] = [];

const queryNsRecords = <A>(query: () => PromiseLike<{ records: readonly A[] }>) =>
  Effect.tryPromise({
    try: () => Promise.resolve(query()),
    catch: error => new NamespaceQueryError({ message: isError(error) ? error.message : String(error) })
  }).pipe(Effect.map(result => result.records));

const installedNsRecords = (connection: Connection) =>
  queryNsRecords(() => connection.query<NsPrefixRecord>('SELECT NamespacePrefix FROM PackageLicense')).pipe(
    Effect.catchTag('NamespaceQueryError', () =>
      queryNsRecords(() =>
        connection.tooling.query<InstalledSubscriberRecord>(
          'SELECT SubscriberPackage.NamespacePrefix FROM InstalledSubscriberPackage'
        )
      ).pipe(Effect.map(records => records.map(rec => ({ NamespacePrefix: rec.SubscriberPackage.NamespacePrefix }))))
    ),
    Effect.catchTag('NamespaceQueryError', () => Effect.succeed(emptyNsRecords))
  );

const orgNsRecords = (connection: Connection) =>
  queryNsRecords(() => connection.query<NsPrefixRecord>('SELECT NamespacePrefix FROM Organization')).pipe(
    Effect.catchTag('NamespaceQueryError', () => Effect.succeed(emptyNsRecords))
  );

const toNamespaceInfo =
  (installedNs: boolean) =>
  (record: NsPrefixRecord): NamespaceInfo => ({
    installedNs,
    namespace: record.NamespacePrefix
  });

/** Namespace discovery is optional; inaccessible queries must not prevent test selection. */
export const queryNamespaces = Effect.fn('Apex.queryNamespaces')(function* (connection: Connection) {
  return yield* Effect.all([installedNsRecords(connection), orgNsRecords(connection)], {
    concurrency: 'unbounded'
  }).pipe(
    Effect.map(([installedRecords, orgRecords]) => [
      ...orgRecords.map(toNamespaceInfo(false)),
      ...installedRecords.map(toNamespaceInfo(true))
    ])
  );
});
