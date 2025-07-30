/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type RetrieveResult, type MetadataMember } from '@salesforce/source-deploy-retrieve';

import { Context, Effect, Layer, pipe } from 'effect';
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
    ConnectionService | ProjectService | WorkspaceService | ConfigService | ChannelService | SettingsService
  >;
};

export const MetadataRetrieveService = Context.GenericTag<MetadataRetrieveService>('MetadataRetrieveService');

const retrieve = (
  members: MetadataMember[]
): Effect.Effect<
  RetrieveResult,
  unknown,
  ConnectionService | ProjectService | WorkspaceService | ConfigService | ChannelService | SettingsService
> =>
  pipe(
    Effect.all([
      Effect.flatMap(ConnectionService, service => service.getConnection),
      Effect.flatMap(ProjectService, service => service.getSfProject),
      Effect.flatMap(WorkspaceService, service => service.getWorkspaceDescription),
      Effect.succeed(ChannelService)
    ]),
    Effect.flatMap(([connection, project, workspaceDescription, channelService]) =>
      workspaceDescription.isEmpty
        ? Effect.fail(new Error('No workspace path found'))
        : Effect.flatMap(channelService, _channel => {
            const output = project.getDefaultPackage().fullPath;
            return Effect.tryPromise({
              try: async () => {
                const { ComponentSet, MetadataApiRetrieve } = await import('@salesforce/source-deploy-retrieve');
                const componentSet = new ComponentSet(members);
                componentSet.apiVersion = '64.0';
                const retrieveOperation = new MetadataApiRetrieve({
                  usernameOrConnection: connection,
                  components: componentSet,
                  output,
                  format: 'source',
                  merge: true
                });
                await retrieveOperation.start();
                return await retrieveOperation.pollStatus();
              },
              catch: e => e
            });
          })
    )
  );

export const MetadataRetrieveServiceLive = Layer.effect(MetadataRetrieveService, Effect.succeed({ retrieve }));
