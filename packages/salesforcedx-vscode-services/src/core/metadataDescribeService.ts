/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { standardValueSet } from '@salesforce/source-deploy-retrieve';
import * as Arr from 'effect/Array';
import * as Cache from 'effect/Cache';
import * as Chunk from 'effect/Chunk';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Option from 'effect/Option';
import * as S from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { referencesToAffectedSObjects } from '../orgCatalog/orgCatalogKeys';
import { OrgMetadataCatalogRecorder } from '../orgCatalog/orgMetadataCatalogRecorder';
import { ChannelService } from '../vscode/channelService';
import { ExtensionContextService } from '../vscode/extensionContextService';
import { SettingsService } from '../vscode/settingsService';
import { ConnectionService } from './connectionService';
import { getDefaultOrgRef } from './defaultOrgRef';
import { FilePropertiesByFullName, FilePropertiesSchema } from './schemas/fileProperties';
import { unknownToErrorCause } from './shared';

const NON_SUPPORTED_TYPES = new Set(['InstalledPackage', 'Profile', 'Scontrol']);
/** Metadata types listed via a folder argument rather than a flat listMetadata call. */
export const FOLDERED_METADATA_TYPES = new Set(['Dashboard', 'Document', 'EmailTemplate', 'Report']);

type DescribeSObjectResult = Awaited<ReturnType<Connection['describe']>>;
type SObjectBatchError = { errorCode: string; message: string };
type SObjectBatchSubRequest = { method: string; url: string };
type SObjectBatchRequest = { batchRequests: SObjectBatchSubRequest[] };
type SObjectBatchSubResponse = { statusCode: number; result: DescribeSObjectResult | SObjectBatchError[] };
type SObjectBatchResponse = { hasErrors: boolean; results: SObjectBatchSubResponse[] };

const SOBJECT_CLIENT_ID = 'sfdx-vscode';
const MAX_SOBJECT_BATCH_SIZE = 25;
const BATCH_API_CONCURRENCY = 15;

const ListMetadataKeySchema = S.Data(
  S.Struct({
    type: S.String,
    folder: S.optional(S.String)
  })
);

/** Subset of the full SObject global describe result */
export type SObjectGlobalDescribeItem = { name: string; custom: boolean; queryable: boolean; triggerable: boolean };

export class MetadataDescribeError extends S.TaggedError<MetadataDescribeError>()('MetadataDescribeError', {
  cause: S.Unknown,
  function: S.String,
  objectName: S.optional(S.String),
  message: S.String
}) {}

export class ListMetadataError extends S.TaggedError<ListMetadataError>()('ListMetadataError', {
  cause: S.Unknown,
  metadataType: S.String,
  folder: S.optional(S.String),
  message: S.String
}) {}

export class MetadataDescribeService extends Effect.Service<MetadataDescribeService>()('MetadataDescribeService', {
  accessors: true,
  dependencies: [
    ConnectionService.Default,
    SettingsService.Default,
    ExtensionContextService.Default,
    ChannelService.Default,
    OrgMetadataCatalogRecorder.Default
  ],
  effect: Effect.gen(function* () {
    const connectionService = yield* ConnectionService;
    const recorder = yield* OrgMetadataCatalogRecorder;
    const getConnection = (orgId: string) => connectionService.getConnectionForOrg(orgId);

    const resolveOrgId = Effect.fn('MetadataDescribeService.resolveOrgId')(function* (expectedOrgId?: string) {
      if (expectedOrgId) {
        yield* connectionService.getConnectionForOrg(expectedOrgId);
        return expectedOrgId;
      }
      const { orgId } = yield* SubscriptionRef.get(yield* getDefaultOrgRef());
      if (orgId) return orgId;
      const connection = yield* connectionService.getConnection();
      const connectionOrgId = connection.getAuthInfoFields().orgId;
      if (connectionOrgId) return connectionOrgId;
      return yield* new MetadataDescribeError({
        cause: new Error('No orgId found in connection'),
        function: 'resolveOrgId',
        message: 'Failed to resolve metadata operation org: No orgId found in connection'
      });
    });

    /** Resolves the org id for invalidation: the explicit org if given, else the active org, or undefined. */
    const resolveOptionalOrgId = Effect.fn('MetadataDescribeService.resolveOptionalOrgId')(function* (
      expectedOrgId?: string
    ) {
      const { orgId: activeOrgId } = yield* SubscriptionRef.get(yield* getDefaultOrgRef());
      return expectedOrgId ?? activeOrgId;
    });

    // ---------------------------------------------------------------------------
    // Performers — execute network calls, used as Cache lookup functions.
    // orgId is passed explicitly for span annotation and connection resolution.
    // ---------------------------------------------------------------------------

    const performDescribe = Effect.fn('MetadataDescribeService.performDescribe')(function* (orgId: string) {
      yield* Effect.annotateCurrentSpan({ orgId });
      const conn = yield* getConnection(orgId);
      const result = yield* Effect.tryPromise({
        try: () => conn.metadata.describe(),
        catch: e => {
          const { cause } = unknownToErrorCause(e);
          return new MetadataDescribeError({
            cause,
            function: 'describe',
            message: `Failed to describe metadata: ${cause.message ?? String(cause)}`
          });
        }
      }).pipe(
        Effect.withSpan('describe (API call)'),
        Effect.map(describeResult =>
          describeResult.metadataObjects.filter(obj => !NON_SUPPORTED_TYPES.has(obj.xmlName))
        ),
        Effect.tap(filteredResult =>
          Effect.flatMap(ChannelService, channel =>
            channel.appendToChannel(`Metadata describe call completed. Found ${filteredResult.length} metadata types.`)
          )
        )
      );
      return result;
    });

    const performListSObjects = Effect.fn('MetadataDescribeService.performListSObjects')(function* (orgId: string) {
      yield* Effect.annotateCurrentSpan({ orgId });
      const conn = yield* getConnection(orgId);
      return yield* Effect.tryPromise({
        try: () => conn.describeGlobal(),
        catch: e => {
          const { cause } = unknownToErrorCause(e);
          return new MetadataDescribeError({
            cause,
            function: 'listSObjects',
            message: `Failed to list sobjects: ${cause.message ?? String(cause)}`
          });
        }
      }).pipe(
        Effect.map(result =>
          result.sobjects.map(
            s =>
              ({
                name: s.name,
                custom: s.custom,
                queryable: s.queryable,
                triggerable: s.triggerable
              }) satisfies SObjectGlobalDescribeItem
          )
        ),
        Effect.withSpan('listSObjects (API call)')
      );
    });

    /**
     * Fetches a single SObject describe from the API.
     * Key is a plain objectName — org isolation is provided by the per-org cache.
     */
    const performDescribeCustomObject = Effect.fn('MetadataDescribeService.performDescribeCustomObject')(function* (
      orgId: string,
      objectName: string
    ) {
      yield* Effect.annotateCurrentSpan({ orgId, objectName });
      const conn = yield* getConnection(orgId);
      return yield* Effect.tryPromise({
        try: () => conn.describe(objectName),
        catch: e => {
          const { cause } = unknownToErrorCause(e);
          return new MetadataDescribeError({
            cause,
            function: 'describeCustomObject',
            objectName,
            message: `Failed to describe sobject ${objectName}: ${cause.message ?? String(cause)}`
          });
        }
      }).pipe(Effect.withSpan('describeCustomObject (API call)', { attributes: { objectName } }));
    });

    /**
     * Fetches metadata component list for a given type/folder from the API.
     * orgId is passed for span annotation; type and folder drive the API call.
     */
    const performListMetadata = Effect.fn('MetadataDescribeService.performListMetadata')(function* (
      orgId: string,
      type: string,
      folder: string | undefined
    ) {
      yield* Effect.annotateCurrentSpan({ orgId, type, folder });

      // StandardValueSet does not support wildcard retrieval via metadata.list — use the
      // static registry from SDR which lists all known StandardValueSet names.
      if (type === 'StandardValueSet' && !folder) {
        return standardValueSet.fullnames
          .map(fullName => ({ fullName, type: 'StandardValueSet' as const }))
          .toSorted((a, b) => a.fullName.localeCompare(b.fullName));
      }

      const conn = yield* getConnection(orgId);
      return yield* Effect.tryPromise({
        try: () => conn.metadata.list({ type, ...(folder ? { folder } : {}) }),
        catch: e => {
          const { cause } = unknownToErrorCause(e);
          return new ListMetadataError({
            cause,
            metadataType: type,
            folder,
            message: `Failed to list metadata type ${type}${folder ? ` in folder ${folder}` : ''}: ${cause.message ?? String(cause)}`
          });
        }
      }).pipe(
        Effect.tap(result => Effect.annotateCurrentSpan({ result })),
        Effect.withSpan('listMetadata (API call)'),
        Effect.map(ensureArray),
        Effect.flatMap(arr => S.decodeUnknown(S.Array(FilePropertiesSchema))(arr)),
        Effect.map(arr => arr.toSorted((a, b) => a.fullName.localeCompare(b.fullName))),
        Effect.map(Arr.dedupeAdjacentWith(FilePropertiesByFullName)),
        Effect.mapError(e => {
          const { cause } = unknownToErrorCause(e);
          return new ListMetadataError({
            cause,
            metadataType: type,
            folder,
            message: `Failed to decode list metadata result for type ${type}${folder ? ` in folder ${folder}` : ''}: ${cause.message ?? String(cause)}`
          });
        })
      );
    });

    const runSObjectBatch = Effect.fn('MetadataDescribeService.runSObjectBatch')(function* (
      orgId: string,
      names: string[]
    ) {
      const conn = yield* getConnection(orgId);
      const body: SObjectBatchRequest = {
        batchRequests: names.map(name => ({ method: 'GET', url: `v${conn.version}/sobjects/${name}/describe` }))
      };
      return yield* Effect.tryPromise({
        try: () =>
          conn.request<SObjectBatchResponse>({
            method: 'POST',
            url: '/composite/batch',
            body: JSON.stringify(body),
            headers: {
              'User-Agent': 'salesforcedx-extension',
              'Sforce-Call-Options': `client=${SOBJECT_CLIENT_ID}`
            }
          }),
        catch: e => {
          const { cause } = unknownToErrorCause(e);
          return new MetadataDescribeError({
            cause,
            function: 'describeCustomObjects',
            message: `Failed to batch describe sobjects: ${cause.message ?? String(cause)}`
          });
        }
      }).pipe(Effect.map(res => res?.results));
    });

    // ---------------------------------------------------------------------------
    // Per-org cache registry.
    //
    // Each org gets its own OrgCacheState (three caches) created lazily on first
    // access. orgId is captured in each loader closure at creation time — loaders
    // never read defaultOrgRef dynamically, eliminating race conditions.
    //
    // The registry itself uses Duration.infinity so org caches persist for the
    // lifetime of the extension session (capacity 20 covers normal multi-org use).
    // ---------------------------------------------------------------------------

    const orgCacheRegistry = yield* Cache.makeWith({
      capacity: 20,
      timeToLive: Exit.match({
        onSuccess: () => Duration.infinity,
        onFailure: () => Duration.zero
      }),
      lookup: (orgId: string) =>
        Effect.gen(function* () {
          const describeCache = yield* Cache.makeWith({
            capacity: 1,
            timeToLive: Exit.match({
              onSuccess: () => Duration.minutes(30),
              onFailure: () => Duration.zero
            }),
            // Singleton cache: one metadata describe result per org.
            // Fixed key 'describe' — the per-org cache provides isolation.
            lookup: (_key: string) => performDescribe(orgId)
          });

          const listSObjectsCache = yield* Cache.makeWith({
            capacity: 1,
            timeToLive: Exit.match({
              onSuccess: () => Duration.minutes(15),
              onFailure: () => Duration.zero
            }),
            // Singleton cache: one global describe result per org.
            lookup: (_key: string) => performListSObjects(orgId)
          });

          const sobjectDescribeCache = yield* Cache.makeWith({
            capacity: 2000,
            timeToLive: Exit.match({
              onSuccess: () => Duration.minutes(15),
              onFailure: () => Duration.zero
            }),
            // Key = plain objectName. Org isolation provided by the per-org cache.
            lookup: (objectName: string) => performDescribeCustomObject(orgId, objectName)
          });

          const listMetadataCache = yield* Cache.makeWith({
            capacity: 500,
            timeToLive: Exit.match({
              onSuccess: () => Duration.minutes(5),
              onFailure: () => Duration.zero
            }),
            // Key = struct { type, folder }. Data.struct provides Hash/Equal.
            lookup: (key: S.Schema.Type<typeof ListMetadataKeySchema>) =>
              performListMetadata(orgId, key.type, key.folder)
          });

          return { describeCache, listSObjectsCache, sobjectDescribeCache, listMetadataCache };
        })
    });

    // ---------------------------------------------------------------------------
    // Public service methods
    // ---------------------------------------------------------------------------

    const invalidateDescribe = Effect.fn('MetadataDescribeService.invalidateDescribe')(function* (
      expectedOrgId?: string
    ) {
      const orgId = yield* resolveOptionalOrgId(expectedOrgId);
      if (!orgId) return;
      const { describeCache } = yield* orgCacheRegistry.get(orgId);
      yield* describeCache.invalidate('describe');
    });

    const invalidateListMetadata = Effect.fn('MetadataDescribeService.invalidateListMetadata')(function* (
      type: string,
      folder?: string,
      expectedOrgId?: string
    ) {
      const orgId = yield* resolveOptionalOrgId(expectedOrgId);
      if (!orgId) return;
      const { listMetadataCache } = yield* orgCacheRegistry.get(orgId);
      const key = yield* S.decode(ListMetadataKeySchema)({ type, folder });
      yield* listMetadataCache.invalidate(key);
    });

    const invalidateAllListMetadata = Effect.fn('MetadataDescribeService.invalidateAllListMetadata')(function* (
      expectedOrgId?: string
    ) {
      const orgId = yield* resolveOptionalOrgId(expectedOrgId);
      if (!orgId) return;
      const { listMetadataCache } = yield* orgCacheRegistry.get(orgId);
      yield* listMetadataCache.invalidateAll;
    });

    const invalidateSObjectDescribe = Effect.fn('MetadataDescribeService.invalidateSObjectDescribe')(function* (
      objectName: string,
      expectedOrgId?: string
    ) {
      const orgId = yield* resolveOptionalOrgId(expectedOrgId);
      if (!orgId) return;
      const { sobjectDescribeCache } = yield* orgCacheRegistry.get(orgId);
      yield* sobjectDescribeCache.invalidate(objectName);
    });

    const invalidateSObjectDescribes = Effect.fn('MetadataDescribeService.invalidateSObjectDescribes')(function* (
      objectNames?: readonly string[],
      expectedOrgId?: string
    ) {
      const orgId = yield* resolveOptionalOrgId(expectedOrgId);
      if (!orgId) return;
      const { sobjectDescribeCache } = yield* orgCacheRegistry.get(orgId);
      yield* objectNames
        ? Effect.forEach(objectNames, objectName => sobjectDescribeCache.invalidate(objectName), { discard: true })
        : sobjectDescribeCache.invalidateAll;
    });

    const invalidateListSObjects = Effect.fn('MetadataDescribeService.invalidateListSObjects')(function* (
      expectedOrgId?: string
    ) {
      const orgId = yield* resolveOptionalOrgId(expectedOrgId);
      if (!orgId) return;
      const { listSObjectsCache } = yield* orgCacheRegistry.get(orgId);
      yield* listSObjectsCache.invalidate('global');
    });

    /** Invalidates listMetadata and SObject describe caches for the metadata types/objects affected by a set of changes. */
    const invalidateForMetadataChanges = Effect.fn('MetadataDescribeService.invalidateForMetadataChanges')(function* (
      orgId: string,
      references: readonly { readonly xmlName: string; readonly fullName: string }[]
    ) {
      const affectedTypes = new Set(references.map(reference => reference.xmlName));
      yield* Effect.forEach(
        affectedTypes,
        xmlName =>
          FOLDERED_METADATA_TYPES.has(xmlName)
            ? invalidateAllListMetadata(orgId)
            : invalidateListMetadata(xmlName, undefined, orgId),
        { discard: true }
      );
      const affectedSObjects = referencesToAffectedSObjects(references);
      if (affectedSObjects.size > 0) {
        yield* invalidateListSObjects(orgId);
        yield* invalidateSObjectDescribes([...affectedSObjects], orgId);
      }
    });

    const describe = Effect.fn('MetadataDescribeService.describe')(function* (expectedOrgId?: string) {
      const orgId = yield* resolveOrgId(expectedOrgId);
      const { describeCache } = yield* orgCacheRegistry.get(orgId);
      return yield* describeCache
        .get('describe')
        .pipe(Effect.tap(result => recorder.recordMetadataTypes(orgId, result)));
    });

    const listSObjects = Effect.fn('MetadataDescribeService.listSObjects')(function* (expectedOrgId?: string) {
      const orgId = yield* resolveOrgId(expectedOrgId);
      const { listSObjectsCache } = yield* orgCacheRegistry.get(orgId);
      return yield* listSObjectsCache
        .get('global')
        .pipe(Effect.tap(result => recorder.recordSObjectList(orgId, result)));
    });

    const describeCustomObject = Effect.fn('MetadataDescribeService.describeCustomObject')(function* (
      objectName: string,
      expectedOrgId?: string
    ) {
      const orgId = yield* resolveOrgId(expectedOrgId);
      const { sobjectDescribeCache } = yield* orgCacheRegistry.get(orgId);
      return yield* sobjectDescribeCache
        .get(objectName)
        .pipe(Effect.tap(result => recorder.recordSObjectDescription(orgId, result)));
    });

    /**
     * Describes multiple SObjects via the composite/batch API (25 per batch,
     * up to 15 batches in flight). Results are written into the per-org
     * sobjectDescribeCache as a side-effect so subsequent single-object lookups
     * via describeCustomObject() benefit from the warm cache.
     *
     * No upfront cache probe — batches start immediately.
     */
    const describeCustomObjects = Effect.fn('MetadataDescribeService.describeCustomObjects')(function* (
      objectNames: string[],
      expectedOrgId?: string
    ) {
      const orgId = yield* resolveOrgId(expectedOrgId);
      const { sobjectDescribeCache } = yield* orgCacheRegistry.get(orgId);

      yield* Effect.annotateCurrentSpan({ objectCount: objectNames.length, orgId });

      // Check which names are already in the cache (concurrent synchronous map lookups).
      // On a warm cache (second run in same session) all 1367 names hit → zero batch API calls.
      const cacheChecks = yield* Effect.all(
        objectNames.map(name => sobjectDescribeCache.getOptionComplete(name).pipe(Effect.map(opt => ({ name, opt })))),
        { concurrency: 'unbounded' }
      );

      const { hits, missNames } = cacheChecks.reduce<{ hits: DescribeSObjectResult[]; missNames: string[] }>(
        (acc, { name, opt }) => {
          if (Option.isSome(opt)) acc.hits.push(opt.value);
          else acc.missNames.push(name);
          return acc;
        },
        { hits: [], missNames: [] }
      );

      yield* Effect.annotateCurrentSpan({ cacheHits: hits.length, cacheMisses: missNames.length });

      if (missNames.length === 0) {
        return Stream.fromIterable(hits).pipe(Stream.tap(result => recorder.recordSObjectDescription(orgId, result)));
      }

      const missStream = Stream.fromIterable(missNames).pipe(
        Stream.grouped(MAX_SOBJECT_BATCH_SIZE),
        Stream.mapEffect(
          batch => {
            const names = Chunk.toArray(batch);
            return runSObjectBatch(orgId, names).pipe(
              Effect.map(results =>
                results.flatMap((sr, i) => (Array.isArray(sr.result) ? [] : [{ name: names[i], result: sr.result }]))
              ),
              Effect.tap(pairs =>
                Effect.all(
                  pairs.map(({ name, result }) => sobjectDescribeCache.set(name, result)),
                  { concurrency: 'unbounded' }
                )
              ),
              Effect.map(pairs => pairs.map(p => p.result))
            );
          },
          { concurrency: BATCH_API_CONCURRENCY }
        ),
        Stream.flattenIterables
      );

      return Stream.concat(Stream.fromIterable(hits), missStream).pipe(
        Stream.tap(result => recorder.recordSObjectDescription(orgId, result))
      );
    });

    const listMetadata = Effect.fn('MetadataDescribeService.listMetadata')(function* (
      type: string,
      folder?: string,
      expectedOrgId?: string
    ) {
      const orgId = yield* resolveOrgId(expectedOrgId);
      const { listMetadataCache } = yield* orgCacheRegistry.get(orgId);
      const key = yield* S.decode(ListMetadataKeySchema)({ type, folder });
      return yield* listMetadataCache
        .get(key)
        .pipe(Effect.tap(result => recorder.recordMetadataListing(orgId, type, folder, result)));
    });

    const listMetadataCached = Effect.fn('MetadataDescribeService.listMetadataCached')(function* (
      type: string,
      folder?: string,
      expectedOrgId?: string
    ) {
      const orgId = yield* resolveOrgId(expectedOrgId);
      const { listMetadataCache } = yield* orgCacheRegistry.get(orgId);
      const key = yield* S.decode(ListMetadataKeySchema)({ type, folder });
      return yield* listMetadataCache.getOptionComplete(key);
    });

    return {
      /** Clears the cached Metadata API describe result for the current org. */
      invalidateDescribe,
      /** Clears all cached listMetadata entries for the current org. */
      invalidateAllListMetadata,
      /** Clears a single cached listMetadata entry (by type+folder) for the current org. */
      invalidateListMetadata,
      /** Clears a single cached SObject describe entry (by name) for the current org. */
      invalidateSObjectDescribe,
      /** Clears selected or all cached SObject describe entries for the current org. */
      invalidateSObjectDescribes,
      /** Clears the cached global SObject listing for the current org. */
      invalidateListSObjects,
      /** Clears listMetadata and SObject describe caches for the types/objects affected by a set of changes. */
      invalidateForMetadataChanges,
      /**
       * Performs a Metadata API describe and returns the result.
       */
      describe,
      /**
       * Calls the Metadata API list method for a given type and optional folder.
       * Results are cached per-org by type+folder key (TTL 5 min).
       */
      listMetadata,
      /**
       * Peeks at the cached listMetadata result for a given type and optional folder
       * without triggering a fetch. Returns Option.none() if not in cache.
       */
      listMetadataCached,
      /**
       * Returns the list of all SObjects in the org with name and custom flag.
       * Uses GET /services/data/v{version}/sobjects/
       */
      listSObjects,
      /**
       * Describes a single SObject by name.
       * Uses GET /services/data/v{version}/sobjects/{objectName}/describe
       */
      describeCustomObject,
      /**
       * Describes multiple SObjects via the composite/batch API (25 per batch,
       * up to 15 batches in flight). Populates the per-org sobject cache as a
       * side-effect. Returns an Effect<Stream> — yield* once to get the Stream,
       * then consume it.
       */
      describeCustomObjects
    };
  })
}) {}

const ensureArray = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);
