/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as S from 'effect/Schema';
import { ChannelService } from '../vscode/channelService';
import { ConnectionService } from './connectionService';
import { FilePropertiesSchema } from './schemas/fileProperties';
import { unknownToErrorCause } from './shared';

const NON_SUPPORTED_TYPES = new Set(['InstalledPackage', 'Profile', 'Scontrol']);

export class MetadataDescribeError extends S.TaggedError<MetadataDescribeError>()('MetadataDescribeError', {
  cause: S.Unknown,
  function: S.String,
  objectName: S.optional(S.String),
  message: S.String
}) {}

export class ListMetadataError extends S.TaggedError<ListMetadataError>()('ListMetadataError', {
  cause: S.Unknown,
  function: S.String,
  metadataType: S.String,
  folder: S.optional(S.String),
  message: S.String
}) {}

export class MetadataDescribeService extends Effect.Service<MetadataDescribeService>()('MetadataDescribeService', {
  accessors: true,
  dependencies: [ConnectionService.Default],
  effect: Effect.gen(function* () {
    // a task that can be cached - uses the key parameter for caching
    const cacheableDescribe = (_key: string = 'cached') =>
      ConnectionService.getConnection().pipe(
        Effect.flatMap(conn =>
          Effect.tryPromise({
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
            Effect.map(result => result.metadataObjects.filter(obj => !NON_SUPPORTED_TYPES.has(obj.xmlName))),
            Effect.tap(result =>
              Effect.flatMap(ChannelService, channel =>
                channel.appendToChannel(`Metadata describe call completed. Found ${result.length} metadata types.`)
              )
            )
          )
        ),
        Effect.withSpan('cacheableDescribe')
      );

    const cachedDescribe = yield* Effect.cachedFunction(cacheableDescribe);

    const describe = Effect.fn('MetadataDescribeService.describe')(function* (forceRefresh = false) {
      return yield* (forceRefresh ? cacheableDescribe(`fresh-${Date.now()}`) : cachedDescribe('cached'));
    });

    // TODO: write the result in a common place that other services can use.  Probably do the same with mdapi describe and list
    const describeCustomObject = Effect.fn('MetadataDescribeService.describeCustomObject')(function* (objectName: string) {
      return yield* ConnectionService.getConnection().pipe(
        Effect.flatMap(conn =>
          Effect.tryPromise({
            try: () => conn.sobject(objectName).describe(),
            catch: e => {
              const { cause } = unknownToErrorCause(e);
              return new MetadataDescribeError({
                cause,
                function: 'describeCustomObject',
                objectName,
                message: `Failed to describe custom object ${objectName}: ${cause.message ?? String(cause)}`
              });
            }
          })
        ),
        Effect.tap(result => Effect.log(result.fields.map(f => f.name).join(', '))),
        Effect.withSpan('describeCustomObject', { attributes: { objectName } })
      );
    });

    const listMetadata = Effect.fn('MetadataDescribeService.listMetadata')(function* (type: string, folder?: string) {
      return yield* ConnectionService.getConnection().pipe(
        Effect.flatMap(conn =>
          Effect.tryPromise({
            try: () => conn.metadata.list({ type, ...(folder ? { folder } : {}) }),
            catch: e => {
              const { cause } = unknownToErrorCause(e);
              return new ListMetadataError({
                cause,
                function: 'listMetadata',
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
            Effect.mapError(
              e => {
                const { cause } = unknownToErrorCause(e);
                return new ListMetadataError({
                  cause,
                  function: 'listMetadata',
                  metadataType: type,
                  folder,
                  message: `Failed to decode list metadata result for type ${type}${folder ? ` in folder ${folder}` : ''}: ${cause.message ?? String(cause)}`
                });
              }
            )
          )
        ),
        Effect.withSpan('listMetadata', { attributes: { metadataType: type, folder } })
      );
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
      describeCustomObject
    } as const;
  })
}) {}

const ensureArray = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);
