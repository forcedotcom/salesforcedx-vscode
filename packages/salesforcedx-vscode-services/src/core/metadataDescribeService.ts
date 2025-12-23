/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as S from 'effect/Schema';
import { ChannelService } from '../vscode/channelService';
import { ConnectionService } from './connectionService';
import { FilePropertiesSchema } from './schemas/fileProperties';
import { unknownToErrorCause } from './shared';

const NON_SUPPORTED_TYPES = new Set(['InstalledPackage', 'Profile', 'Scontrol']);

export class MetadataDescribeError extends Data.TaggedError('MetadataDescribeError')<{
  readonly cause: unknown;
  readonly function: string;
  readonly objectName?: string;
}> {}

export class ListMetadataError extends Data.TaggedError('ListMetadataError')<{
  readonly cause: unknown;
  readonly function: string;
  readonly metadataType: string;
  readonly folder?: string;
}> {}

export class MetadataDescribeService extends Effect.Service<MetadataDescribeService>()('MetadataDescribeService', {
  effect: Effect.gen(function* () {
    // a task that can be cached - uses the key parameter for caching
    const cacheableDescribe = (_key: string = 'cached') =>
      Effect.flatMap(ConnectionService, svc => svc.getConnection).pipe(
        Effect.flatMap(conn =>
          Effect.tryPromise({
            try: () => conn.metadata.describe(),
            catch: e => new MetadataDescribeError({ ...unknownToErrorCause(e), function: 'describe' })
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

    const describe = (forceRefresh = false) =>
      forceRefresh ? cacheableDescribe(`fresh-${Date.now()}`) : cachedDescribe('cached');

    // TODO: write the result in a common place that other services can use.  Probably do the same with mdapi describe and list
    const describeCustomObject = (objectName: string) =>
      Effect.flatMap(ConnectionService, svc => svc.getConnection).pipe(
        Effect.flatMap(conn =>
          Effect.tryPromise({
            try: () => conn.sobject(objectName).describe(),
            catch: e =>
              new MetadataDescribeError({ ...unknownToErrorCause(e), function: 'describeCustomObject', objectName })
          })
        ),
        Effect.tap(result => Effect.log(result.fields.map(f => f.name).join(', '))),
        Effect.withSpan('describeCustomObject', { attributes: { objectName } })
      );

    const listMetadata = (type: string, folder?: string) =>
      Effect.flatMap(ConnectionService, svc => svc.getConnection).pipe(
        Effect.flatMap(conn =>
          Effect.tryPromise({
            try: () => conn.metadata.list({ type, ...(folder ? { folder } : {}) }),
            catch: e =>
              new ListMetadataError({ ...unknownToErrorCause(e), function: 'listMetadata', metadataType: type, folder })
          }).pipe(
            Effect.tap(result => Effect.annotateCurrentSpan({ result })),
            Effect.withSpan('listMetadata (API call)'),
            Effect.map(ensureArray),
            Effect.map(arr => arr.toSorted((a, b) => a.fullName.localeCompare(b.fullName))),
            Effect.flatMap(arr => S.decodeUnknown(S.Array(FilePropertiesSchema))(arr)),
            Effect.mapError(
              e =>
                new ListMetadataError({
                  ...unknownToErrorCause(e),
                  function: 'listMetadata',
                  metadataType: type,
                  folder
                })
            )
          )
        ),
        Effect.withSpan('listMetadata', { attributes: { metadataType: type, folder } })
      );
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
  }),
  dependencies: [ConnectionService.Default]
}) {}

const ensureArray = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);
