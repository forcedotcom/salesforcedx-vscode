/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Cache from 'effect/Cache';
import * as Chunk from 'effect/Chunk';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Option from 'effect/Option';
import * as S from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { ChannelService } from '../vscode/channelService';
import { ExtensionContextService } from '../vscode/extensionContextService';
import { SettingsService } from '../vscode/settingsService';
import { ConnectionService } from './connectionService';
import { getDefaultOrgRef } from './defaultOrgRef';
import { FilePropertiesSchema } from './schemas/fileProperties';
import { unknownToErrorCause } from './shared';

const NON_SUPPORTED_TYPES = new Set(['InstalledPackage', 'Profile', 'Scontrol']);

type DescribeSObjectResult = Awaited<ReturnType<Connection['describe']>>;
type SObjectBatchError = { errorCode: string; message: string };
type SObjectBatchSubRequest = { method: string; url: string };
type SObjectBatchRequest = { batchRequests: SObjectBatchSubRequest[] };
type SObjectBatchSubResponse = { statusCode: number; result: DescribeSObjectResult | SObjectBatchError[] };
type SObjectBatchResponse = { hasErrors: boolean; results: SObjectBatchSubResponse[] };

const SOBJECT_CLIENT_ID = 'sfdx-vscode';
const MAX_SOBJECT_BATCH_SIZE = 25;
const BATCH_API_CONCURRENCY = 15;

/** Subset of the full SObject global describe result */
export type SObjectGlobalDescribeItem = { name: string; custom: boolean; queryable: boolean };

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
    ChannelService.Default
  ],
  effect: Effect.gen(function* () {
    const connectionService = yield* ConnectionService;

    // ---------------------------------------------------------------------------
    // Performers — execute network calls, used as Cache lookup functions.
    // orgId is passed explicitly for span annotation; the actual connection is
    // resolved from ConnectionService (which always targets the active org).
    // ---------------------------------------------------------------------------

    const performDescribe = Effect.fn('MetadataDescribeService.performDescribe')(function* (orgId: string) {
      yield* Effect.annotateCurrentSpan({ orgId });
      const conn = yield* connectionService.getConnection();
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
      const conn = yield* connectionService.getConnection();
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
            s => ({ name: s.name, custom: s.custom, queryable: s.queryable }) satisfies SObjectGlobalDescribeItem
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
      objectName: string
    ) {
      yield* Effect.annotateCurrentSpan({ objectName });
      const conn = yield* connectionService.getConnection();
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
      const conn = yield* connectionService.getConnection();
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
        Effect.map(arr => arr.toSorted((a, b) => a.fullName.localeCompare(b.fullName))),
        Effect.flatMap(arr => S.decodeUnknown(S.Array(FilePropertiesSchema))(arr)),
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

    const runSObjectBatch = Effect.fn('MetadataDescribeService.runSObjectBatch')(function* (names: string[]) {
      const conn = yield* connectionService.getConnection();
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
            capacity: 5,
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
            lookup: (objectName: string) => performDescribeCustomObject(objectName)
          });

          const listMetadataCache = yield* Cache.makeWith({
            capacity: 500,
            timeToLive: Exit.match({
              onSuccess: () => Duration.minutes(5),
              onFailure: () => Duration.zero
            }),
            // Key = "${type}:${folder ?? ''}". Colons do not appear in Salesforce XML type names.
            lookup: (key: string) => {
              const colonIdx = key.indexOf(':');
              const type = key.slice(0, colonIdx);
              const folder = key.slice(colonIdx + 1) || undefined;
              return performListMetadata(orgId, type, folder);
            }
          });

          return { describeCache, listSObjectsCache, sobjectDescribeCache, listMetadataCache };
        })
    });

    // ---------------------------------------------------------------------------
    // Public service methods
    // ---------------------------------------------------------------------------

    const describe = Effect.fn('MetadataDescribeService.describe')(function* (forceRefresh = false) {
      const { orgId } = yield* SubscriptionRef.get(yield* getDefaultOrgRef());

      if (!orgId) {
        return yield* Effect.fail(
          new MetadataDescribeError({
            cause: new Error('No orgId found in connection'),
            function: 'describe',
            message: 'Failed to describe metadata: No orgId found in connection'
          })
        );
      }

      const { describeCache } = yield* orgCacheRegistry.get(orgId);
      if (forceRefresh) {
        yield* describeCache.invalidate('describe');
      }
      return yield* describeCache.get('describe');
    });

    const listSObjects = Effect.fn('MetadataDescribeService.listSObjects')(function* () {
      const { orgId } = yield* SubscriptionRef.get(yield* getDefaultOrgRef());
      const { listSObjectsCache } = yield* orgCacheRegistry.get(orgId ?? 'default');
      return yield* listSObjectsCache.get('global');
    });

    const describeCustomObject = Effect.fn('MetadataDescribeService.describeCustomObject')(function* (
      objectName: string
    ) {
      const { orgId } = yield* SubscriptionRef.get(yield* getDefaultOrgRef());
      const { sobjectDescribeCache } = yield* orgCacheRegistry.get(orgId ?? 'default');
      return yield* sobjectDescribeCache.get(objectName);
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
      objectNames: string[]
    ) {
      const { orgId } = yield* SubscriptionRef.get(yield* getDefaultOrgRef());
      const { sobjectDescribeCache } = yield* orgCacheRegistry.get(orgId ?? 'default');

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
        return Stream.fromIterable(hits);
      }

      const missStream = Stream.fromIterable(missNames).pipe(
        Stream.grouped(MAX_SOBJECT_BATCH_SIZE),
        Stream.mapEffect(
          batch => {
            const names = Chunk.toArray(batch);
            return runSObjectBatch(names).pipe(
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

      return Stream.concat(Stream.fromIterable(hits), missStream);
    });

    const listMetadata = Effect.fn('MetadataDescribeService.listMetadata')(function* (
      type: string,
      folder?: string,
      forceRefresh = false
    ) {
      const { orgId } = yield* SubscriptionRef.get(yield* getDefaultOrgRef());
      const { listMetadataCache } = yield* orgCacheRegistry.get(orgId ?? 'default');
      const key = `${type}:${folder ?? ''}`;
      if (forceRefresh) yield* listMetadataCache.invalidate(key);
      return yield* listMetadataCache.get(key);
    });

    return {
      /**
       * Performs a Metadata API describe and returns the result.
       * When forceRefresh=true, bypasses the cache and makes a fresh API call.
       */
      describe,
      /**
       * Calls the Metadata API list method for a given type and optional folder.
       * Results are cached per-org by type+folder key (TTL 5 min).
       * When forceRefresh=true, invalidates the specific entry and re-fetches.
       */
      listMetadata,
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
