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

import * as Brand from 'effect/Brand';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as vscode from 'vscode';
import { SdkLayer } from '../observability/spans';
import { SuccessfulCancelResult } from '../vscode/cancellation';
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
  RetrieveResult | SuccessfulCancelResult,
  Error,
  ConnectionService | ProjectService | WorkspaceService | ConfigService | SettingsService | MetadataRegistryService
> =>
  Effect.gen(function* () {
    const [connection, project, workspaceDescription, registryAccess] = yield* Effect.all(
      [
        Effect.flatMap(ConnectionService, service => service.getConnection),
        Effect.flatMap(ProjectService, service => service.getSfProject),
        Effect.flatMap(WorkspaceService, service => service.getWorkspaceInfo),
        Effect.flatMap(MetadataRegistryService, service => service.getRegistryAccess())
      ],
      { concurrency: 'unbounded' }
    );

    if (workspaceDescription.isEmpty) {
      return yield* Effect.fail(new Error('No workspace path found'));
    }

    const componentSet = yield* buildComponentSet(members);

    const retrieveFiber = yield* Effect.fork(
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

          const retrieveResult = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `Retrieving ${members.map(m => `${m.type}: ${m.fullName === '*' ? 'all' : m.fullName}`).join(', ')}`,
              cancellable: true
            },
            async (_, token) => {
              token.onCancellationRequested(async () => {
                await retrieveOperation.cancel();
                await Effect.runPromise(Fiber.interrupt(retrieveFiber));
              });
              await retrieveOperation.start();
              return await retrieveOperation.pollStatus();
            }
          );
          return retrieveResult;
        },
        catch: e => {
          console.error(e);
          return new Error('Failed to retrieve metadata', { cause: e });
        }
      })
    ).pipe(Effect.withSpan('retrieve (API call)'));

    return yield* Effect.matchCauseEffect(Fiber.join(retrieveFiber), {
      onFailure: cause =>
        Cause.isInterruptedOnly(cause)
          ? Effect.succeed(Brand.nominal<SuccessfulCancelResult>()('User canceled'))
          : Effect.failCause(cause),
      onSuccess: result => Effect.succeed(result)
    });
  }).pipe(Effect.withSpan('retrieve', { attributes: { members } }), Effect.provide(SdkLayer));

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
