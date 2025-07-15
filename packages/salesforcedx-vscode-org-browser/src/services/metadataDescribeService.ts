/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Context, Effect, Layer } from 'effect';
import * as Option from 'effect/Option';
import * as S from 'effect/Schema';
import type { ConfigService } from 'salesforcedx-vscode-services/src/core/configService';
import type { ConnectionService } from 'salesforcedx-vscode-services/src/core/connectionService';
import type { ChannelService } from 'salesforcedx-vscode-services/src/vscode/channelService';
import type { FsService } from 'salesforcedx-vscode-services/src/vscode/fsService';
import type { WorkspaceService } from 'salesforcedx-vscode-services/src/vscode/workspaceService';
import * as vscode from 'vscode';
import { DescribeMetadataObjectsSchema, DescribeMetadataObject } from '../schemas/describeMetadataObject';
import { FilePropertiesSchema, FileProperties } from '../schemas/fileProperties';
import { ExtensionProviderService } from './extensionProvider';

export type MetadataDescribeService = {
  /**
   * Performs a Metadata API describe and stores the result as JSON in orgs/<orgId>/.sf/metadata/describe.json
   * Returns the raw describe result. Only calls the org if forceRefresh is true or the file does not exist.
   */
  readonly describeAndStore: (
    forceRefresh?: boolean
  ) => Effect.Effect<
    readonly DescribeMetadataObject[],
    Error,
    ConnectionService | ConfigService | WorkspaceService | FsService | ChannelService
  >;
  /**
   * Calls the Metadata API list method for a given type and optional folder.
   * Returns the list of metadata components for that type.
   */
  readonly listMetadata: (
    type: string,
    folder?: string
  ) => Effect.Effect<
    readonly FileProperties[],
    Error,
    ConnectionService | WorkspaceService | ConfigService | ChannelService | FsService
  >;
};

export const MetadataDescribeService = Context.GenericTag<MetadataDescribeService>('MetadataDescribeService');

export const MetadataDescribeServiceLive = Layer.effect(
  MetadataDescribeService,
  Effect.gen(function* () {
    const svcProvider = yield* ExtensionProviderService;
    const api = yield* svcProvider.getServicesApi;
    const ConnectionService = api.services.ConnectionService;
    const WorkspaceService = api.services.WorkspaceService;
    const FsService = api.services.FsService;

    const describeAndStore = (
      forceRefresh: boolean = false
    ): Effect.Effect<
      readonly DescribeMetadataObject[],
      Error,
      ConnectionService | ConfigService | WorkspaceService | FsService | ChannelService
    > =>
      Effect.context<ConnectionService | ConfigService | WorkspaceService | FsService | ChannelService>().pipe(
        Effect.flatMap(() =>
          Effect.gen(function* () {
            // Get workspace path and orgId first (needed for both branches)
            const connectionService = yield* ConnectionService;
            const workspaceService = yield* WorkspaceService;
            const fsService = yield* FsService;
            const conn = yield* connectionService.getConnection;
            const identity = yield* Effect.tryPromise({
              try: () => conn.identity(),
              catch: e => new Error(`Identity failed: ${String(e)}`)
            });
            const orgId = identity.organization_id;
            if (!orgId) return yield* Effect.fail(new Error('No orgId found'));
            const maybePath = yield* workspaceService.getWorkspacePath;
            if (Option.isNone(maybePath)) return yield* Effect.fail(new Error('No workspace folder found'));
            const wsPath = maybePath.value;
            const describePath = vscode.Uri.joinPath(
              vscode.Uri.file(wsPath),
              '.sf',
              'orgs',
              orgId,
              'metadata',
              'describe.json'
            ).fsPath;

            // If forceRefresh, always fetch and write
            if (forceRefresh) {
              const describeResult = yield* Effect.tryPromise({
                try: () => conn.metadata.describe(),
                catch: e => new Error(`Describe failed: ${String(e)}`)
              });
              yield* fsService.writeFile(describePath, JSON.stringify(describeResult.metadataObjects, null, 2));
              return describeResult.metadataObjects;
            }

            // Otherwise, check if file exists
            const fileExists = yield* fsService.fileOrFolderExists(describePath);
            if (fileExists) {
              return yield* fsService.readJSON(describePath, DescribeMetadataObjectsSchema);
            }

            // File doesn't exist, fetch and write
            const fetchedDescribeResult = yield* Effect.tryPromise({
              try: () => conn.metadata.describe(),
              catch: e => new Error(`Describe failed: ${String(e)}`)
            });
            yield* fsService.writeFile(describePath, JSON.stringify(fetchedDescribeResult.metadataObjects, null, 2));
            return fetchedDescribeResult.metadataObjects;
          })
        )
      );

    // Add listMetadata implementation
    const listMetadata = (
      type: string,
      folder?: string
    ): Effect.Effect<
      readonly FileProperties[],
      Error,
      ConnectionService | WorkspaceService | ConfigService | ChannelService | FsService
    > =>
      Effect.flatMap(
        Effect.context<ConnectionService | WorkspaceService | ConfigService | ChannelService | FsService>(),
        () =>
          Effect.gen(function* () {
            const connectionService = yield* ConnectionService;
            const workspaceService = yield* WorkspaceService;
            const fsService = yield* FsService;
            const conn = yield* connectionService.getConnection;
            const identity = yield* Effect.tryPromise({
              try: () => conn.identity(),
              catch: e => new Error(`Identity failed: ${String(e)}`)
            });
            const orgId = identity.organization_id;
            if (!orgId) return yield* Effect.fail(new Error('No orgId found'));
            const maybePath = yield* workspaceService.getWorkspacePath;
            if (Option.isNone(maybePath)) return yield* Effect.fail(new Error('No workspace folder found'));
            const wsPath = maybePath.value;
            const folderPart = folder ? `-${folder}` : '';
            const listPath = vscode.Uri.joinPath(
              vscode.Uri.file(wsPath),
              '.sf',
              'orgs',
              orgId,
              'metadata',
              'list',
              `${type}${folderPart}.json`
            ).fsPath;

            // Try to read from file
            const fileExists = yield* fsService.fileOrFolderExists(listPath);
            if (fileExists) {
              return yield* fsService.readJSON(listPath, S.Array(FilePropertiesSchema));
            }

            // If not found, call API
            const result = yield* Effect.tryPromise({
              try: () => conn.metadata.list({ type, ...(folder ? { folder } : {}) }),
              catch: e => new Error(`listMetadata failed for type ${type}: ${String(e)}`)
            });
            const arr = Array.isArray(result) ? result : [result];
            const validated = yield* S.decodeUnknown(S.Array(FilePropertiesSchema))(arr).pipe(
              Effect.mapError(e => new Error(`Failed to decode FileProperties: ${String(e)}`))
            );

            // Write to file
            yield* fsService.writeFile(listPath, JSON.stringify(validated, null, 2));

            return validated;
          })
      );

    return { describeAndStore, listMetadata };
  })
);
