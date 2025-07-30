/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Context, Effect, Layer, pipe } from 'effect';
import * as S from 'effect/Schema';
import type { ConfigService } from 'salesforcedx-vscode-services/src/core/configService';
import type { ConnectionService } from 'salesforcedx-vscode-services/src/core/connectionService';
import type { ChannelService } from 'salesforcedx-vscode-services/src/vscode/channelService';
import type { SettingsService } from 'salesforcedx-vscode-services/src/vscode/settingsService';
import type { WorkspaceService } from 'salesforcedx-vscode-services/src/vscode/workspaceService';
import { DescribeMetadataObject } from '../schemas/describeMetadataObject';
import { FilePropertiesSchema, FileProperties } from '../schemas/fileProperties';
import { ExtensionProviderService } from './extensionProvider';

type DescribeContext = ConnectionService | ConfigService | WorkspaceService | ChannelService | SettingsService;

export type MetadataDescribeService = {
  /**
   * Performs a Metadata API describe and returns the result.
   * The forceRefresh parameter is kept for future Effect-based caching implementation.
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
};

export const MetadataDescribeService = Context.GenericTag<MetadataDescribeService>('MetadataDescribeService');

const NON_SUPPORTED_TYPES = new Set(['InstalledPackage', 'Profile', 'Scontrol']);

export const MetadataDescribeServiceLive = Layer.effect(
  MetadataDescribeService,
  Effect.gen(function* () {
    const svcProvider = yield* ExtensionProviderService;
    const api = yield* svcProvider.getServicesApi;
    const ConnectionService = api.services.ConnectionService;

    // a task that can be cached
    const cacheableDescribe = (
      _forceRefresh: boolean = false
    ): Effect.Effect<readonly DescribeMetadataObject[], Error, DescribeContext> =>
      pipe(
        Effect.flatMap(ConnectionService, svc => svc.getConnection),
        Effect.flatMap(conn =>
          pipe(
            Effect.tryPromise({
              try: () => conn.metadata.describe(),
              catch: e => new Error(`Describe failed: ${String(e)}`)
            }),
            Effect.map(result => result.metadataObjects.filter(obj => !NON_SUPPORTED_TYPES.has(obj.xmlName))),
            Effect.tap(result =>
              pipe(
                Effect.flatMap(api.services.ChannelService, channel =>
                  channel.appendToChannel(`Metadata describe call completed. Found ${result.length} metadata types.`)
                ),
                Effect.catchAll(() => Effect.succeed(void 0))
              )
            )
          )
        )
      );

    const cachedDescribe = yield* Effect.cachedFunction(cacheableDescribe);

    const describe = (
      forceRefresh = false
    ): Effect.Effect<readonly DescribeMetadataObject[], Error, DescribeContext> =>
      forceRefresh ? cacheableDescribe(true) : cachedDescribe(false);

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
            }),
            Effect.map(ensureArray),
            Effect.map(arr => arr.sort((a, b) => a.fullName.localeCompare(b.fullName))),
            Effect.flatMap(arr => S.decodeUnknown(S.Array(FilePropertiesSchema))(arr)),
            Effect.mapError(e => new Error(`Failed to decode FileProperties: ${String(e)}`))
          )
        )
      );

    return { describe, listMetadata };
  })
);

const ensureArray = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);
