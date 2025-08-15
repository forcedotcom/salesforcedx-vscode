/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  type RetrieveResult,
  type MetadataMember,
  type MetadataRegistry,
  RegistryAccess,
  MetadataApiRetrieve,
  ComponentSet
} from '@salesforce/source-deploy-retrieve';

import { Context, Effect, Layer, pipe } from 'effect';
import * as vscode from 'vscode';
import { WebSdkLayer } from '../observability/spans';
import { ChannelService } from '../vscode/channelService';
import { SettingsService } from '../vscode/settingsService';
import { WorkspaceService } from '../vscode/workspaceService';
import { ConfigService } from './configService';
import { ConnectionService } from './connectionService';
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
    | MetadataRetrieveService
  >;

  readonly getRegistry: () => Effect.Effect<Readonly<MetadataRegistry>, Error, WorkspaceService>;
  readonly getRegistryAccess: () => Effect.Effect<RegistryAccess, Error, WorkspaceService>;
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

const getRegistryAccess = (): Effect.Effect<RegistryAccess, Error, WorkspaceService> =>
  Effect.flatMap(WorkspaceService, service => service.getWorkspaceInfo).pipe(
    Effect.flatMap(workspaceInfo =>
      Effect.try({
        try: () => new RegistryAccess(undefined, workspaceInfo.fsPath),
        catch: (error: unknown) => new Error(`Failed to create RegistryAccess: ${String(error)}`)
      })
    ),
    Effect.withSpan('getRegistryAccess')
  );

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
  | MetadataRetrieveService
> =>
  pipe(
    Effect.all(
      [
        Effect.flatMap(ConnectionService, service => service.getConnection),
        Effect.flatMap(ProjectService, service => service.getSfProject),
        Effect.flatMap(WorkspaceService, service => service.getWorkspaceInfo),
        Effect.succeed(ChannelService),
        Effect.flatMap(MetadataRetrieveService, service => service.getRegistryAccess())
      ],
      { concurrency: 'unbounded' }
    ),
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
                      title: `Retrieving ${members.map(m => m.type).join(', ')}`,
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
            )
      )
    )
  )
    .pipe(Effect.withSpan('retrieve'))
    .pipe(Effect.provide(WebSdkLayer));

export const MetadataRetrieveServiceLive = Layer.scoped(
  MetadataRetrieveService,
  Effect.gen(function* () {
    // Create shared registry access once and derive everything from it
    const cachedGetRegistryAccessEffect = yield* Effect.cached(getRegistryAccess());

    // Derive registry from the cached registry access
    const cachedGetRegistryEffect = yield* Effect.cached(
      Effect.flatMap(cachedGetRegistryAccessEffect, registryAccess =>
        Effect.try({
          try: () => registryAccess.getRegistry(),
          catch: (error: unknown) => new Error(`Failed to get registry: ${String(error)}`)
        })
      ).pipe(Effect.withSpan('getRegistry (cached)'))
    );

    return {
      retrieve,
      getRegistry: (): Effect.Effect<Readonly<MetadataRegistry>, Error, WorkspaceService> => cachedGetRegistryEffect,
      getRegistryAccess: (): Effect.Effect<RegistryAccess, Error, WorkspaceService> => cachedGetRegistryAccessEffect
    };
  })
);
