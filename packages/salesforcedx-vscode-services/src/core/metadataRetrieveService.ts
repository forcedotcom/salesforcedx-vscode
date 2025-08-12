/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SfProject } from '@salesforce/core/project';
import {
  type RetrieveResult,
  type MetadataMember,
  MetadataApiRetrieve,
  ComponentSet
} from '@salesforce/source-deploy-retrieve';
import { Context, Effect, Layer, pipe } from 'effect';
import * as vscode from 'vscode';
import { ChannelService } from '../vscode/channelService';
import { SettingsService } from '../vscode/settingsService';
import { WorkspaceService } from '../vscode/workspaceService';
import { ConfigService } from './configService';
import { ConnectionService, type SalesforceConnection } from './connectionService';
import { ProjectService } from './projectService';

const METADATA_API_VERSION = '64.0';
const METADATA_FORMAT = 'source' as const;
const PROGRESS_LOCATION = vscode.ProgressLocation.Notification;

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

const createComponentSet = (members: MetadataMember[]): Effect.Effect<ComponentSet, never, never> =>
  Effect.sync(() => {
    const componentSet = new ComponentSet(members);
    componentSet.apiVersion = METADATA_API_VERSION;
    return componentSet;
  });

const createRetrieveOperation = (
  connection: SalesforceConnection,
  componentSet: ComponentSet,
  output: string
): MetadataApiRetrieve =>
  new MetadataApiRetrieve({
    usernameOrConnection: connection,
    components: componentSet,
    output,
    format: METADATA_FORMAT,
    merge: true
  });

const createProgressOptions = (memberTypes: string[]): vscode.ProgressOptions => ({
  location: PROGRESS_LOCATION,
  title: `Retrieving ${memberTypes.join(', ')}`,
  cancellable: false
});

const executeRetrieveOperation = async (operation: MetadataApiRetrieve): Promise<RetrieveResult> => {
  await operation.start();
  return await operation.pollStatus();
};

const performMetadataRetrieve = (
  connection: SalesforceConnection,
  project: SfProject,
  members: MetadataMember[]
): Effect.Effect<RetrieveResult, Error> =>
  Effect.gen(function* () {
    const [output, componentSet] = yield* Effect.all(
      [Effect.sync(() => project.getDefaultPackage().fullPath), createComponentSet(members)],
      { concurrency: 'unbounded' }
    );

    const retrieveOperation = createRetrieveOperation(connection, componentSet, output);

    const memberTypes = members.map(m => m.type);
    const progressOptions = createProgressOptions(memberTypes);

    return yield* Effect.promise(() =>
      vscode.window.withProgress(progressOptions, () => executeRetrieveOperation(retrieveOperation))
    );
  });

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
      Effect.flatMap(WorkspaceService, service => service.getWorkspaceInfo)
    ]),
    Effect.flatMap(([connection, project, workspaceDescription]) =>
      workspaceDescription.isEmpty
        ? Effect.fail(new Error('No workspace path found'))
        : performMetadataRetrieve(connection, project, members)
    )
  );

export const MetadataRetrieveServiceLive = Layer.effect(MetadataRetrieveService, Effect.succeed({ retrieve }));
