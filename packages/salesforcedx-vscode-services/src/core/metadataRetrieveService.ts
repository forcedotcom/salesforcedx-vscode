/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  type RetrieveResult,
  type MetadataMember,
  MetadataApiRetrieve,
  ComponentSet
} from '@salesforce/source-deploy-retrieve';

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { SdkLayer } from '../observability/spans';
import { ChannelService } from '../vscode/channelService';
import { SettingsService } from '../vscode/settingsService';
import { WorkspaceService } from '../vscode/workspaceService';
import { ConfigService } from './configService';
import { ConnectionService } from './connectionService';
import { MetadataRegistryService } from './metadataRegistryService';
import { ProjectService } from './projectService';

const buildComponentSetFromSource = (
  members: MetadataMember[],
  sourcePaths: string[]
): Effect.Effect<ComponentSet, Error, MetadataRegistryService | WorkspaceService> =>
  Effect.gen(function* () {
    console.log('buildComponentSetFromSource', members, sourcePaths);
    const include = members.length > 0 ? yield* buildComponentSet(members) : undefined;
    const registryAccess = yield* (yield* MetadataRegistryService).getRegistryAccess();
    const cs = yield* Effect.try({
      try: () => ComponentSet.fromSource({ fsPaths: sourcePaths, include, registry: registryAccess }),
      catch: e => new Error('Failed to build ComponentSet from source', { cause: e })
    });
    yield* Effect.annotateCurrentSpan({ size: cs.size });
    return cs;
  }).pipe(Effect.withSpan('buildComponentSetFromSource'));

const buildComponentSet = (
  members: MetadataMember[]
): Effect.Effect<ComponentSet, Error, MetadataRegistryService | WorkspaceService> =>
  Effect.gen(function* () {
    const registryAccess = yield* (yield* MetadataRegistryService).getRegistryAccess();
    return yield* Effect.try({
      try: () => new ComponentSet(members, registryAccess),
      catch: e => new Error('Failed to build ComponentSet', { cause: e })
    });
  }).pipe(Effect.withSpan('buildComponentSet'));

const retrieve = (
  members: MetadataMember[]
): Effect.Effect<
  RetrieveResult,
  unknown,
  | ConnectionService
  | ProjectService
  | WorkspaceService
  | ConfigService
  | ChannelService
  | SettingsService
  | MetadataRegistryService
> =>
  Effect.all(
    [
      Effect.flatMap(ConnectionService, service => service.getConnection),
      Effect.flatMap(ProjectService, service => service.getSfProject),
      Effect.flatMap(WorkspaceService, service => service.getWorkspaceInfo),
      Effect.succeed(ChannelService),
      Effect.flatMap(MetadataRegistryService, service => service.getRegistryAccess())
    ],
    { concurrency: 'unbounded' }
  ).pipe(
    Effect.flatMap(([connection, project, workspaceDescription, channelService, registryAccess]) =>
      Effect.flatMap(buildComponentSet(members), componentSet =>
        workspaceDescription.isEmpty
          ? Effect.fail(new Error('No workspace path found'))
          : Effect.flatMap(channelService, _channel =>
              Effect.tryPromise({
                try: async () => {
                  const retrieveOperation = new MetadataApiRetrieve({
                    usernameOrConnection: connection,
                    components: componentSet,
                    output: project.getDefaultPackage().fullPath,
                    format: 'source',
                    merge: true,
                    registry: registryAccess
                  });

                  const result = await vscode.window.withProgress(
                    {
                      location: vscode.ProgressLocation.Notification,
                      title: `Retrieving ${members.map(m => `${m.type}: ${m.fullName === '*' ? 'all' : m.fullName}`).join(', ')}`,
                      cancellable: false
                    },
                    async () => {
                      await retrieveOperation.start();
                      return await retrieveOperation.pollStatus();
                    }
                  );
                  return result;
                },
                catch: e => {
                  console.error(e);
                  return new Error('Failed to retrieve metadata', { cause: e });
                }
              })
            ).pipe(Effect.withSpan('retrieve (API call)'))
      )
    ),
    Effect.withSpan('retrieve', { attributes: { members } }),
    Effect.provide(SdkLayer)
  );

export class MetadataRetrieveService extends Effect.Service<MetadataRetrieveService>()('MetadataRetrieveService', {
  succeed: {
    /**
     * Retrieve one or more metadata components from the default org.
     * @param members - Array of MetadataMember (type, fullName)
     * @returns Effect that resolves to SDR's RetrieveResult
     */
    retrieve,
    buildComponentSet,
    buildComponentSetFromSource
  } as const
}) {}
