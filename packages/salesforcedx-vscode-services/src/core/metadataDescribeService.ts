/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ConfigService } from './configService';
import type { DescribeMetadataObject } from './schemas/describeMetadataObject';
import type { SettingsService } from '../vscode/settingsService';
import type { WorkspaceService } from '../vscode/workspaceService';
import { Context, Effect, Layer, pipe } from 'effect';
import * as S from 'effect/Schema';
import type { DescribeSObjectResult } from 'jsforce';
import { SdkLayer } from '../observability/spans';
import { ChannelService } from '../vscode/channelService';
import { ConnectionService } from './connectionService';
import { FilePropertiesSchema, type FileProperties } from './schemas/fileProperties';

type DescribeContext = ConnectionService | ConfigService | WorkspaceService | ChannelService | SettingsService;

export type MetadataDescribeService = {
  /**
   * Performs a Metadata API describe and returns the result.
   * When forceRefresh=true, bypasses the cache and makes a fresh API call.
   */
  readonly describe: (
    forceRefresh?: boolean
  ) => Effect.Effect<readonly DescribeMetadataObject[], Error, DescribeContext>;
  /**
   * Calls the Metadata API list method for a given type and optional folder.
   * Returns the list of metadata components for that type.
   */
  readonly listMetadata: (
    type: string,
    folder?: string
  ) => Effect.Effect<readonly FileProperties[], Error, DescribeContext>;

  readonly describeCustomObject: (objectName: string) => Effect.Effect<DescribeSObjectResult, Error, DescribeContext>;
};

export const MetadataDescribeService = Context.GenericTag<MetadataDescribeService>('MetadataDescribeService');

const NON_SUPPORTED_TYPES = new Set(['InstalledPackage', 'Profile', 'Scontrol']);

export const MetadataDescribeServiceLive = Layer.effect(
  MetadataDescribeService,
  Effect.gen(function* () {
    // a task that can be cached - uses the key parameter for caching
    const cacheableDescribe = (
      _key: string = 'cached'
    ): Effect.Effect<readonly DescribeMetadataObject[], Error, DescribeContext> =>
      pipe(
        Effect.flatMap(ConnectionService, svc => svc.getConnection),
        Effect.flatMap(conn =>
          pipe(
            Effect.tryPromise({
              try: () => conn.metadata.describe(),
              catch: e => new Error(`Describe failed: ${String(e)}`)
            }).pipe(Effect.withSpan('describe (API call)')),
            Effect.map(result => result.metadataObjects.filter(obj => !NON_SUPPORTED_TYPES.has(obj.xmlName))),
            Effect.tap(result =>
              pipe(
                Effect.flatMap(ChannelService, channel =>
                  channel.appendToChannel(`Metadata describe call completed. Found ${result.length} metadata types.`)
                ),
                Effect.catchAll(() => Effect.succeed(void 0))
              )
            )
          )
        )
      )
        .pipe(Effect.withSpan('cacheableDescribe'))
        .pipe(Effect.provide(SdkLayer));

    const cachedDescribe = yield* Effect.cachedFunction(cacheableDescribe);

    const describe = (
      forceRefresh = false
    ): Effect.Effect<readonly DescribeMetadataObject[], Error, DescribeContext> =>
      forceRefresh ? cacheableDescribe(`fresh-${Date.now()}`) : cachedDescribe('cached');

    // TODO: write this in a common place that other services can use
    const describeCustomObject = (objectName: string): Effect.Effect<DescribeSObjectResult, Error, DescribeContext> =>
      pipe(
        Effect.flatMap(ConnectionService, svc => svc.getConnection),
        Effect.flatMap(conn =>
          Effect.tryPromise({
            try: () => conn.sobject(objectName).describe(),
            catch: e => new Error(`describeCustomObject failed for object ${objectName}: ${String(e)}`)
          })
        ),
        Effect.tap(result => Effect.log(result.fields.map(f => f.name))),
        Effect.withSpan('describeCustomObject', { attributes: { objectName } }),
        Effect.provide(SdkLayer)
      );

    const listMetadata = (
      type: string,
      folder?: string
    ): Effect.Effect<readonly FileProperties[], Error, DescribeContext> =>
      pipe(
        Effect.flatMap(ConnectionService, svc => svc.getConnection),
        Effect.flatMap(conn =>
          pipe(
            Effect.tryPromise({
              try: () => conn.metadata.list({ type, ...(folder ? { folder } : {}) }),
              catch: e => new Error(`listMetadata failed for type ${type}: ${String(e)}`)
            }).pipe(Effect.withSpan('listMetadata (API call)')),
            Effect.map(ensureArray),
            Effect.map(arr => arr.sort((a, b) => a.fullName.localeCompare(b.fullName))),
            Effect.flatMap(arr => S.decodeUnknown(S.Array(FilePropertiesSchema))(arr)),
            Effect.mapError(e => new Error(`Failed to decode FileProperties: ${String(e)}`))
          )
        ),
        Effect.withSpan('listMetadata', { attributes: { metadataType: type, folder } }),
        Effect.provide(SdkLayer)
      );

    return { describe, listMetadata, describeCustomObject };
  })
);

const ensureArray = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);
