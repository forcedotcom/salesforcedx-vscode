/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  type RetrieveResult,
  type MetadataMember,
  type RegistryAccess,
  MetadataApiRetrieve,
  ComponentSet
} from '@salesforce/source-deploy-retrieve';

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { SdkLayer } from '../observability/spans';
import { ChannelService } from '../vscode/channelService';
import { SettingsService } from '../vscode/settingsService';
import { WorkspaceService } from '../vscode/workspaceService';
import { ConfigService } from './configService';
import { ConnectionService } from './connectionService';
import { MetadataRegistryService } from './metadataRegistryService';
import { ProjectService } from './projectService';

export type MetadataRetrieveService = {
  /**
   * Retrieve one or more metadata components from the default org.
   * @param members - Array of MetadataMember (type, fullName)
   * @returns Effect that resolves to SDR's RetrieveResult
   */
  readonly retrieve: (
    members: MetadataMember[]
  ) => Effect.Effect<
    RetrieveResult,
    unknown,
    | ConnectionService
    | ProjectService
    | WorkspaceService
    | ConfigService
    | ChannelService
    | SettingsService
    | MetadataRegistryService
  >;

  /** given a type and name, return a glob pattern that can be used to search for the file in the local project */
  readonly getLocationGlob: (
    type: string,
    name: string
    // folder?: string
  ) => Effect.Effect<string, Error, WorkspaceService | MetadataRegistryService>;
};

export const MetadataRetrieveService = Context.GenericTag<MetadataRetrieveService>('MetadataRetrieveService');

const buildComponentSet = (
  members: MetadataMember[],
  registryAccess: RegistryAccess
): Effect.Effect<ComponentSet, Error> =>
  Effect.try({
    try: () => new ComponentSet(members, registryAccess),
    catch: e => new Error('Failed to build ComponentSet', { cause: e })
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
      Effect.flatMap(buildComponentSet(members, registryAccess), componentSet =>
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

const getLocationGlob = (
  type: string,
  name: string
  // folder?: string
): Effect.Effect<string, Error, WorkspaceService | MetadataRegistryService> =>
  Effect.gen(function* () {
    const registryAccess = yield* Effect.flatMap(MetadataRegistryService, service => service.getRegistryAccess());
    const mdType = registryAccess.getTypeByName(type);
    return `**/${mdType.directoryName}/${name}.${mdType.suffix}-meta.xml`;
  });

export const MetadataRetrieveServiceLive = Layer.effect(
  MetadataRetrieveService,
  Effect.gen(function* () {
    return {
      retrieve,
      getLocationGlob
    };
  })
);
