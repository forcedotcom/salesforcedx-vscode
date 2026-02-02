/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Cache from 'effect/Cache';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as S from 'effect/Schema';
import { ChannelService } from '../vscode/channelService';
import { ExtensionContextService } from '../vscode/extensionContextService';
import { SettingsService } from '../vscode/settingsService';
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
    const conn = yield* ConnectionService.getConnection();
    const performDescribe = (orgId: string) =>
      Effect.gen(function* () {
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
              channel.appendToChannel(
                `Metadata describe call completed. Found ${filteredResult.length} metadata types.`
              )
            )
          )
        );
        return result;
      }).pipe(Effect.withSpan('performDescribe', { attributes: { orgId } }));

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
      const orgId = conn.getAuthInfoFields().orgId;

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

    // TODO: write the result in a common place that other services can use.  Probably do the same with mdapi describe and list
    const describeCustomObject = Effect.fn('MetadataDescribeService.describeCustomObject')(function* (
      objectName: string
    ) {
      const result = yield* Effect.tryPromise({
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
      });

      Effect.log(result.fields.map(f => f.name).join(', '));
      return result;
    });

    const listMetadata = Effect.fn('MetadataDescribeService.listMetadata')(function* (type: string, folder?: string) {
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
      describeCustomObject
    } as const;
  })
}) {}

const ensureArray = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);
