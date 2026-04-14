/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { DeployResult, RetrieveResult } from '@salesforce/source-deploy-retrieve';
import * as Chunk from 'effect/Chunk';
import * as DateTime from 'effect/DateTime';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as Option from 'effect/Option';
import * as Order from 'effect/Order';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { HashableUri } from 'salesforcedx-vscode-services';
import { type URI, Utils } from 'vscode-uri';
import { nls } from '../messages';
import { MissingDefaultOrgError } from '../shared/diff/diffErrors';
import { getStaleUris } from './resultStorageCleanup';
import { getFileProperties } from './shared';

/** One metadata component within a stored result file. lastModifiedDate is the server-reported
 * value for retrieves, or the server completedDate (falling back to client timestamp) for deploys. */
const StoredComponentSchema = Schema.Struct({
  metadataType: Schema.String,
  fullName: Schema.String,
  lastModifiedDate: Schema.optional(Schema.String)
});

/** On-disk JSON shape: one file per deploy/retrieve, recording which components were included
 * and when the operation happened. Stored under .sfdx/fileResponses/{orgId}/. */
const StoredResultSchema = Schema.Struct({
  /** the timestamp from the deploy/retrieve operation */
  timestamp: Schema.DateTimeUtc,
  operation: Schema.Literal('deploy', 'retrieve'),
  components: Schema.Array(StoredComponentSchema)
});

type StoredComponent = Schema.Schema.Type<typeof StoredComponentSchema>;

/** Codec that round-trips StoredResult through JSON string ↔ typed object. */
const StoredResultJsonSchema = Schema.parseJson(StoredResultSchema);

/** Intermediate row used while building the timestamp index. Flattens each component with its
 * resolved lastModifiedDate (server value when available, else file timestamp) and the parent
 * file's timestamp (fileTimestamp — for newest-first sorting so first-write-wins per key).
 * sourceUri tracks the origin file for stale-file detection. */
type TimestampRow = {
  key: string;
  lastModifiedDate: DateTime.Utc;
  fileTimestamp: DateTime.Utc;
  sourceUri: HashableUri;
};

const componentKey = (metadataType: string, fullName: string) => `${metadataType}:${fullName}`;

const toStoredComponent = (metadataType: string, fullName: string, lastModifiedDate: string) =>
  Schema.decodeSync(StoredComponentSchema)({ metadataType, fullName, lastModifiedDate });

/** Resolve the per-org storage directory: {workspaceRoot}/.sfdx/fileResponses/{orgId}/ */
const getFileResponsesDirUri = Effect.fn('resultStorage.getFileResponsesDirUri')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [workspaceInfo, defaultOrgRef] = yield* Effect.all(
    [api.services.WorkspaceService.getWorkspaceInfoOrThrow(), Effect.succeed(api.services.TargetOrgRef)],
    { concurrency: 'unbounded' }
  );
  const orgId = (yield* SubscriptionRef.get(yield* defaultOrgRef())).orgId;
  if (!orgId) {
    return yield* new MissingDefaultOrgError({ message: nls.localize('missing_default_org') });
  }
  return Utils.joinPath(workspaceInfo.uri, '.sfdx', 'fileResponses', orgId);
});

/** Encode a result to JSON and write it to .sfdx/fileResponses/{orgId}/{operation}-{timestamp}.json */
const storeResult = Effect.fn('resultStorage.storeResult')(function* (
  operation: 'deploy' | 'retrieve',
  components: StoredComponent[],
  timestamp: DateTime.Utc
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const dirUri = yield* getFileResponsesDirUri();
  yield* api.services.FsService.createDirectory(dirUri);
  const json = yield* Schema.encode(StoredResultJsonSchema)({ timestamp, operation, components });
  yield* api.services.FsService.safeWriteFile(
    Utils.joinPath(dirUri, `${operation}-${DateTime.formatIso(timestamp).replaceAll(/[:.]/g, '-')}.json`),
    json
  );
});

const isSucceeded = (status: string | undefined) => status === 'Succeeded' || status === 'SucceededPartial';

const orgTracksSource = Effect.fn('resultStorage.orgTracksSource')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const orgInfo = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
  return orgInfo.tracksSource === true;
});

/** Store deploy result JSON if the deploy succeeded and the org doesn't track source.
 * Uses completedDate from deployResult, falling back to client timestamp. */
export const maybeStoreDeployResult = Effect.fn('resultStorage.maybeStoreDeployResult')(function* (
  result: DeployResult
) {
  if (!isSucceeded(result.response?.status) || (yield* orgTracksSource())) return;

  const timestamp = result.response?.completedDate
    ? DateTime.unsafeMake(new Date(result.response.completedDate))
    : DateTime.unsafeMake(new Date());
  const components = result
    .getFileResponses() // we don't have timestamps on fileResponse
    .map(fr => toStoredComponent(fr.type, fr.fullName, DateTime.formatIso(timestamp)));
  yield* storeResult('deploy', components, timestamp);
});

/** Store retrieve result JSON if the retrieve succeeded and the org doesn't track source.
 * Uses lastModifiedDate from fileProperties per component. */
export const maybeStoreRetrieveResult = Effect.fn('resultStorage.maybeStoreRetrieveResult')(function* (
  result: RetrieveResult
) {
  if (!isSucceeded(result.response?.status) || (yield* orgTracksSource())) return;

  const timestamp = DateTime.unsafeMake(new Date());
  const components = getFileProperties(result).map(fp => toStoredComponent(fp.type, fp.fullName, fp.lastModifiedDate));
  yield* storeResult('retrieve', components, timestamp);
});

/** Core index-building logic. Reads all .json files under dirUri, builds the timestamp index,
 * then forks background cleanup to delete files whose components were all superseded by newer files.
 * Exported for unit testing — provide a mock ExtensionProviderService that returns a mock FsService. */
export const buildTimestampIndexFromDir = Effect.fn('resultStorage.buildTimestampIndexFromDir')(function* (
  dirUri: URI
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fs = yield* api.services.FsService;

  const exists = yield* fs.fileOrFolderExists(dirUri);
  if (!exists) return new Map<string, DateTime.Utc>();

  const allJsonUris = HashSet.fromIterable(
    (yield* fs.readDirectory(dirUri)).filter(u => u.toString().endsWith('.json')).map(u => fs.HashableUri.fromUri(u))
  );

  const byKey = yield* Stream.fromIterable(allJsonUris).pipe(
    Stream.mapEffect(uri =>
      fs.readFile(uri.toUri()).pipe(
        Effect.tapError(e => Effect.logWarning('skipping unreadable result file', e)),
        Effect.option,
        // Attach sourceUri so each row remembers which file it came from.
        Effect.map(textOpt => ({
          uri,
          stored: Option.flatMap(textOpt, text => Schema.decodeUnknownOption(StoredResultJsonSchema)(text))
        }))
      )
    ),
    Stream.mapConcat(({ uri, stored }) =>
      Option.match(stored, {
        onNone: () => [],
        onSome: s =>
          s.components.map(
            (c): TimestampRow => ({
              key: componentKey(c.metadataType, c.fullName),
              // falling back to the file-level timestamp when a component lacks its own lastModifiedDate.
              lastModifiedDate: Option.getOrElse(
                DateTime.make(c.lastModifiedDate ?? DateTime.formatIso(s.timestamp)),
                () => s.timestamp
              ),
              fileTimestamp: s.timestamp,
              sourceUri: uri
            })
          )
      })
    ),
    Stream.runCollect,
    Effect.map(chunk => Chunk.toReadonlyArray(chunk).toSorted(byFileTimestampDesc)),
    // Group by component key; first entry wins because rows are sorted newest-first.
    Effect.map(sortedArray => Object.groupBy(sortedArray, (x: TimestampRow) => x.key)),
    // Delete stale files in the background — best-effort, must not block the caller.
    Effect.tap(bk => Effect.forkDaemon(Effect.forEach(getStaleUris(bk, allJsonUris), uri => fs.safeDelete(uri.toUri()))))
  );

  return new Map(Object.entries(byKey).map(([key, rows]) => [key, rows![0].lastModifiedDate]));
});

/** Load every stored result file, flatten components into rows sorted newest-first,
 * then group by component key keeping only the most recent lastModifiedDate per component.
 * Returns Map<"MetadataType:FullName", DateTime.Utc> for O(1) conflict lookups. */
export const buildTimestampIndex = Effect.fn('resultStorage.buildTimestampIndex')(function* () {
  return yield* getFileResponsesDirUri().pipe(Effect.flatMap(buildTimestampIndexFromDir));
});

const byFileTimestampDesc = Order.reverse(
  Order.mapInput(Order.number, (x: TimestampRow) => DateTime.toEpochMillis(x.fileTimestamp))
);
