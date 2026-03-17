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
import * as Order from 'effect/Order';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { Utils } from 'vscode-uri';
import { nls } from '../messages';
import { MissingDefaultOrgError } from '../shared/diff/diffErrors';

/** One metadata component within a stored result file. lastModifiedDate is the server-reported
 * value for retrieves, or the client timestamp at deploy time (DeployResult lacks per-component dates). */
const StoredComponentSchema = Schema.Struct({
  metadataType: Schema.String,
  fullName: Schema.String,
  lastModifiedDate: Schema.optional(Schema.String)
});

/** On-disk JSON shape: one file per deploy/retrieve, recording which components were included
 * and when the operation happened. Stored under .sfdx/fileResponses/{orgId}/. */
const StoredResultSchema = Schema.Struct({
  timestamp: Schema.DateTimeUtc,
  operation: Schema.Literal('deploy', 'retrieve'),
  components: Schema.Array(StoredComponentSchema)
});

type StoredComponent = Schema.Schema.Type<typeof StoredComponentSchema>;

/** Codec that round-trips StoredResult through JSON string ↔ typed object. */
const StoredResultJsonSchema = Schema.parseJson(StoredResultSchema);

/** Intermediate row used while building the timestamp index. Flattens each component with its
 * resolved lastModifiedDate (server value when available, else file timestamp) and the parent
 * file's timestamp (fileTimestamp — for newest-first sorting so first-write-wins per key). */
const TimestampRowSchema = Schema.Struct({
  key: Schema.String,
  lastModifiedDate: Schema.DateTimeUtc,
  fileTimestamp: Schema.DateTimeUtc
});

type TimestampRow = Schema.Schema.Type<typeof TimestampRowSchema>;

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

/** Store deploy result JSON if the org doesn't track source and the deploy succeeded.
 * Uses client timestamp per component (DeployResult has no per-component lastModifiedDate). */
export const maybeStoreDeployResult = Effect.fn('resultStorage.maybeStoreDeployResult')(function* (
  result: DeployResult
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const orgInfo = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
  if (orgInfo.tracksSource === true) return;

  const status = result.response?.status?.toString();
  if (status !== 'Succeeded' && status !== 'SucceededPartial') return;

  const timestamp = DateTime.unsafeMake(new Date());
  const components = result
    .getFileResponses()
    .map(fr => toStoredComponent(fr.type, fr.fullName, DateTime.formatIso(timestamp)));
  yield* storeResult('deploy', components, timestamp);
});

/** Store retrieve result JSON. Uses lastModifiedDate from fileProperties per component. */
export const storeRetrieveResult = Effect.fn('resultStorage.storeRetrieveResult')(function* (result: RetrieveResult) {
  const timestamp = DateTime.unsafeMake(new Date());
  const fileProps = Array.isArray(result.response.fileProperties)
    ? result.response.fileProperties
    : [result.response.fileProperties];
  const components = fileProps.map(fp => toStoredComponent(fp.type, fp.fullName, fp.lastModifiedDate));
  yield* storeResult('retrieve', components, timestamp);
});

/** Load every stored result file, flatten components into rows sorted newest-first,
 * then group by component key keeping only the most recent lastModifiedDate per component.
 * Returns Map<"MetadataType:FullName", DateTime.Utc> for O(1) conflict lookups. */
export const buildTimestampIndex = Effect.fn('resultStorage.buildTimestampIndex')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const dirUri = yield* getFileResponsesDirUri();
  const exists = yield* api.services.FsService.fileOrFolderExists(dirUri);
  if (!exists) {
    return new Map<string, DateTime.Utc>();
  }

  const byKey = yield* Stream.fromIterableEffect(api.services.FsService.readDirectory(dirUri)).pipe(
    Stream.filter(uri => uri.toString().endsWith('.json')),
    Stream.mapEffect(uri => api.services.FsService.readFile(uri)),
    Stream.flatMap(text => Schema.decodeUnknown(StoredResultJsonSchema)(text)),
    Stream.mapConcat(stored =>
      stored.components.map(c => ({
        key: componentKey(c.metadataType, c.fullName),
        // falling back to the file-level timestamp when a component lacks its own lastModifiedDate.
        lastModifiedDate: c.lastModifiedDate ?? DateTime.formatIso(stored.timestamp),
        fileTimestamp: DateTime.formatIso(stored.timestamp)
      }))
    ),
    Stream.map(row => Schema.decodeSync(TimestampRowSchema)(row)),
    Stream.runCollect,
    Effect.map(chunk => Chunk.toReadonlyArray(chunk).toSorted(byFileTimestampDesc)),
    // Group by component key; first entry wins because rows are sorted newest-first.
    Effect.map(sortedArray => Object.groupBy(sortedArray, (x: TimestampRow) => x.key))
  );

  return new Map(Object.entries(byKey).map(([key, rows]) => [key, rows![0].lastModifiedDate]));
});

const byFileTimestampDesc = Order.reverse(
  Order.mapInput(Order.number, (x: TimestampRow) => DateTime.toEpochMillis(x.fileTimestamp))
);
