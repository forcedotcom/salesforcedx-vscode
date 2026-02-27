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

    const describeCache = yield* Cache.makeWith({
      capacity: 20, // Maximum number of cached describe results (one per org)
      timeToLive: Exit.match({
        onSuccess: () => Duration.minutes(30),
        onFailure: () => Duration.zero
      }),
      lookup: (orgId: string) =>
        performDescribe(orgId).pipe(Effect.withSpan('performDescribe lookup', { attributes: { orgId } }))
    });

    const describe = Effect.fn('MetadataDescribeService.describe')(function* (forceRefresh = false) {
      const defaultOrgRef = yield* getDefaultOrgRef();
      const { orgId } = yield* SubscriptionRef.get(defaultOrgRef);

      if (!orgId) {
        return yield* Effect.fail(
          new MetadataDescribeError({
            cause: new Error('No orgId found in connection'),
            function: 'describe',
            message: 'Failed to describe metadata: No orgId found in connection'
          })
        );
      }

      if (forceRefresh) {
        yield* describeCache.invalidate(orgId);
      }

      return yield* describeCache.get(orgId);
    });

    const performListSObjects = (orgId: string) =>
      Effect.gen(function* () {
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
      }).pipe(Effect.withSpan('performListSObjects', { attributes: { orgId } }));

    const listSObjectsCache = yield* Cache.makeWith({
      capacity: 20,
      timeToLive: Exit.match({
        onSuccess: () => Duration.minutes(30),
        onFailure: () => Duration.zero
      }),
      lookup: (orgId: string) => performListSObjects(orgId)
    });

    const listSObjects = Effect.fn('MetadataDescribeService.listSObjects')(function* () {
      const orgId = (yield* connectionService.getConnection()).getAuthInfoFields().orgId ?? 'default';
      return yield* listSObjectsCache.get(orgId);
    });

    const performDescribeCustomObject = Effect.fn('MetadataDescribeService.performDescribeCustomObject')(function* (
      cacheKey: string
    ) {
      yield* Effect.annotateCurrentSpan({ cacheKey });
      const objectName = cacheKey.slice(cacheKey.indexOf(':') + 1);
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

    const runSObjectBatch = Effect.fn('MetadataDescribeService.runSObjectBatch')(function* (names: string[]) {
      const conn = yield* connectionService.getConnection();
      const body: SObjectBatchRequest = {
        batchRequests: names.map(name => ({ method: 'GET', url: `${conn.version}/sobjects/${name}/describe` }))
      };
      return yield* Effect.tryPromise({
        try: () =>
          conn.request<SObjectBatchResponse>({
            method: 'POST',
            url: 'composite/batch',
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

    const sobjectDescribeCache = yield* Cache.makeWith({
      capacity: 500,
      timeToLive: Exit.match({
        onSuccess: () => Duration.minutes(30),
        onFailure: () => Duration.zero
      }),
      lookup: (cacheKey: string) => performDescribeCustomObject(cacheKey)
    });

    const describeCustomObject = Effect.fn('MetadataDescribeService.describeCustomObject')(function* (
      objectName: string
    ) {
      const defaultOrgRef = yield* getDefaultOrgRef();
      const { orgId } = yield* SubscriptionRef.get(defaultOrgRef);
      return yield* sobjectDescribeCache.get(`${orgId}:${objectName}`);
    });

    const describeCustomObjects = Effect.fn('MetadataDescribeService.describeCustomObjects')(function* (
      objectNames: string[]
    ) {
      return Stream.fromIterable(objectNames).pipe(
        Stream.grouped(MAX_SOBJECT_BATCH_SIZE),
        Stream.mapEffect(batch => runSObjectBatch(Chunk.toArray(batch))),
        Stream.map(results => results.flatMap(sr => (Array.isArray(sr.result) ? [] : [sr.result]))),
        Stream.tap(batchResults => Effect.annotateCurrentSpan({ batchResults })),
        Stream.flattenIterables
      );
    });

    const listMetadata = Effect.fn('MetadataDescribeService.listMetadata')(function* (type: string, folder?: string) {
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

      // Effect.withSpan('listMetadata', { attributes: { metadataType: type, folder } })
    });

    return {
      /**
       * Performs a Metadata API describe and returns the result.
       * When forceRefresh=true, bypasses the cache and makes a fresh API call.
       */
      describe,
      /**
       * Calls the Metadata API list method for a given type and optional folder.
       * Returns the list of metadata components for that type.
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
       * Describes multiple SObjects using the composite/batch API (25 per batch, all batches in parallel).
       * Uses POST /services/data/v{version}/composite/batch
       */
      describeCustomObjects
    };
  })
}) {}

const ensureArray = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);
