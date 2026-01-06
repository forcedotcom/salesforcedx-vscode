/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import type { SfProject } from '@salesforce/core/project';
import {
  type MetadataMember,
  MetadataApiRetrieve,
  ComponentSet,
  type RegistryAccess
} from '@salesforce/source-deploy-retrieve';

import * as Brand from 'effect/Brand';
import * as Cause from 'effect/Cause';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as vscode from 'vscode';
import { SuccessfulCancelResult } from '../vscode/cancellation';
import { WorkspaceService } from '../vscode/workspaceService';
import { FailedToBuildComponentSetError, setComponentSetProperties } from './componentSetService';
import { ConfigService } from './configService';
import { ConnectionService } from './connectionService';
import { MetadataRegistryService } from './metadataRegistryService';
import { ProjectService } from './projectService';
import { unknownToErrorCause } from './shared';
import { SourceTrackingService } from './sourceTrackingService';

export class MetadataRetrieveError extends Data.TaggedError('MetadataRetrieveError')<{
  readonly cause: unknown;
}> {}

/** Build a ComponentSet from source paths.
 *
 * If you pass a members array, that will be used to filter the components (componentSet will only include the members you pass in)
 *
 * pass an empty array to include all components from the source paths
 *
 */
const buildComponentSetFromSource = (sourcePaths: string[], filterMembers: MetadataMember[]) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan({ filterMembers, sourcePaths });
    const include = filterMembers.length > 0 ? yield* buildComponentSet(filterMembers) : undefined;
    const registryAccess = yield* (yield* MetadataRegistryService).getRegistryAccess();
    const cs = yield* Effect.try({
      try: () => ComponentSet.fromSource({ fsPaths: sourcePaths, include, registry: registryAccess }),
      catch: e => new FailedToBuildComponentSetError(unknownToErrorCause(e))
    });
    yield* Effect.annotateCurrentSpan({ size: cs.size });
    return cs;
  }).pipe(Effect.withSpan('buildComponentSetFromSource'));

const buildComponentSet = (members: MetadataMember[]) =>
  Effect.gen(function* () {
    const registryAccess = yield* (yield* MetadataRegistryService).getRegistryAccess();
    return yield* Effect.try({
      try: () => new ComponentSet(members, registryAccess),
      catch: e => new FailedToBuildComponentSetError(unknownToErrorCause(e))
    });
  }).pipe(Effect.withSpan('buildComponentSet'));

const retrieve = (members: MetadataMember[]) =>
  Effect.gen(function* () {
    const [connection, project, registryAccess] = yield* Effect.all(
      [
        Effect.flatMap(ConnectionService, service => service.getConnection),
        Effect.flatMap(ProjectService, service => service.getSfProject),
        Effect.flatMap(MetadataRegistryService, service => service.getRegistryAccess()),
        Effect.flatMap(WorkspaceService, service => service.getWorkspaceInfoOrThrow)
      ],
      { concurrency: 'unbounded' }
    );

    const componentSet = yield* buildComponentSet(members);

    const title = `Retrieving ${members.map(m => `${m.type}: ${m.fullName === '*' ? 'all' : m.fullName}`).join(', ')}`;
    return yield* performRetrieveOperation(componentSet, connection, project, registryAccess, title);
  }).pipe(Effect.withSpan('retrieve', { attributes: { members } }));

/** Shared helper to perform the actual retrieve operation */
const performRetrieveOperation = (
  componentSet: ComponentSet,
  connection: Connection,
  project: SfProject,
  registryAccess: RegistryAccess,
  title: string
) =>
  Effect.gen(function* () {
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
              title,
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
          return new MetadataRetrieveError(unknownToErrorCause(e));
        }
      }).pipe(Effect.withSpan('retrieve (API call)'))
    );

    const retrieveOutcome = yield* Effect.matchCauseEffect(Fiber.join(retrieveFiber), {
      onFailure: cause =>
        Cause.isInterruptedOnly(cause)
          ? Effect.succeed(Brand.nominal<SuccessfulCancelResult>()('User canceled'))
          : Effect.failCause(cause),
      onSuccess: outcome => Effect.succeed(outcome)
    });

    if (typeof retrieveOutcome !== 'string') {
      yield* Effect.annotateCurrentSpan({ fileResponses: retrieveOutcome.getFileResponses().map(r => r.filePath) });
      yield* Effect.flatMap(SourceTrackingService, svc => svc.updateTrackingFromRetrieve(retrieveOutcome)).pipe(
        Effect.withSpan('MetadataRetrieveService.updateTrackingFromRetrieve')
      );
    }

    return retrieveOutcome;
  });

/** Retrieve metadata using a ComponentSet directly */
const retrieveComponentSet = (components: ComponentSet) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan({ components: components.size });
    const [connection, project, registryAccess, configAggregator] = yield* Effect.all(
      [
        Effect.flatMap(ConnectionService, service => service.getConnection),
        Effect.flatMap(ProjectService, service => service.getSfProject),
        Effect.flatMap(MetadataRegistryService, service => service.getRegistryAccess()),
        Effect.flatMap(ConfigService, service => service.getConfigAggregator),
        Effect.flatMap(WorkspaceService, service => service.getWorkspaceInfoOrThrow)
      ],
      { concurrency: 'unbounded' }
    );

    yield* setComponentSetProperties(components, project, configAggregator);

    const title = `Retrieving ${components.size} component${components.size === 1 ? '' : 's'}`;
    return yield* performRetrieveOperation(components, connection, project, registryAccess, title);
  }).pipe(Effect.withSpan('retrieveComponentSet', { attributes: { componentCount: components.size } }));

export class MetadataRetrieveService extends Effect.Service<MetadataRetrieveService>()('MetadataRetrieveService', {
  succeed: {
    /**
     * Retrieve one or more metadata components from the default org.
     * @param members - Array of MetadataMember (type, fullName)
     * @returns Effect that resolves to SDR's RetrieveResult
     */
    retrieve,
    /**
     * Retrieve metadata using a ComponentSet directly.
     * Sets project directory and API versions on the ComponentSet before retrieving.
     * @param components - ComponentSet to retrieve
     * @returns Effect that resolves to SDR's RetrieveResult
     */
    retrieveComponentSet,
    buildComponentSet,
    buildComponentSetFromSource
  } as const
}) {}
