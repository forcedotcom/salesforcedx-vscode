/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OrgConfigProperties } from '@salesforce/core';
import type { ConfigAggregator } from '@salesforce/core/configAggregator';
import type { SfProject } from '@salesforce/core/project';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { type SourceTracking } from '@salesforce/source-tracking';
import * as Brand from 'effect/Brand';
import * as Cause from 'effect/Cause';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import { isString } from 'effect/Predicate';
import * as vscode from 'vscode';
import { SuccessfulCancelResult } from '../vscode/cancellation';
import { ChannelService } from '../vscode/channelService';
import { WorkspaceService } from '../vscode/workspaceService';
import { ensureNonEmptyComponentSet, FailedToBuildComponentSetError } from './componentSetService';
import { ConfigService } from './configService';
import { ConnectionService } from './connectionService';
import { MetadataRegistryService } from './metadataRegistryService';
import { FailedToResolveSfProjectError, ProjectService } from './projectService';
import { unknownToErrorCause } from './shared';
import { type SourceTrackingOptions, SourceTrackingService } from './sourceTrackingService';

export class MetadataDeployError extends Data.TaggedError('FailedToDeployMetadataError')<{
  readonly cause: unknown;
}> {}

/** Get ComponentSet of local changes for deploy */
const getComponentSetForDeploy = (options?: SourceTrackingOptions) =>
  Effect.gen(function* () {
    const tracking = yield* Effect.flatMap(SourceTrackingService, svc => svc.getSourceTracking(options));
    if (!tracking) {
      return yield* Effect.die(
        'Source tracking not enabled.  The command should not have appeared in the Command Palette.'
      );
    }
    yield* Effect.promise(() => tracking.reReadLocalTrackingCache()).pipe(
      Effect.withSpan('STL.ReReadLocalTrackingCache')
    );

    if (!options?.ignoreConflicts) {
      yield* conflictCheck(tracking).pipe(Effect.provide(ChannelService.Default));
    }
    const localComponentSets = yield* Effect.tryPromise(() => tracking.localChangesAsComponentSet(false)).pipe(
      Effect.withSpan('STL.LocalChangesAsComponentSet')
    );

    yield* Effect.annotateCurrentSpan({
      files: localComponentSets
        .flatMap(cs => Array.from(cs.getSourceComponents()))
        .flatMap(c => [c.xml, c.content])
        .filter(isString)
        .join(','),
      projectDirectory: localComponentSets[0]?.projectDirectory
    });
    return localComponentSets[0] ?? new ComponentSet();
  }).pipe(Effect.withSpan('getComponentSetForDeploy'));

const conflictCheck = (tracking: SourceTracking) =>
  Effect.gen(function* () {
    const conflicts = yield* Effect.tryPromise(() => tracking.getConflicts()).pipe(Effect.withSpan('STL.GetConflicts'));
    if (conflicts?.length > 0) {
      yield* Effect.annotateCurrentSpan({
        conflicts: true
      });
      yield* Effect.flatMap(ChannelService, channelService =>
        channelService.appendToChannel(
          [
            'Conflicts detected',
            ...conflicts.flatMap(c => [`  ${c.type}:${c.name} (${(c.filenames ?? []).join(', ')})`])
          ].join('\n')
        )
      );
      (yield* Effect.flatMap(ChannelService, channelService => channelService.getChannel)).show();
      return yield* Effect.fail(
        new Error(
          'Local and remote changes detected on the same file(s).  See output channel for details. Run a push or pull with ignored conflicts to proceed.'
        )
      );
    }
  });

/** Deploy metadata to the default org */
const deploy = (components: ComponentSet) =>
  Effect.gen(function* () {
    const [connection, project] = yield* Effect.all(
      [
        Effect.flatMap(ConnectionService, service => service.getConnection),
        Effect.flatMap(ProjectService, service => service.getSfProject),
        Effect.flatMap(WorkspaceService, service => service.getWorkspaceInfoOrThrow),
        Effect.annotateCurrentSpan({ components: components.size })
      ],
      { concurrency: 'unbounded' }
    );

    components.projectDirectory = project.getPath();

    const deployFiber = yield* Effect.fork(
      Effect.tryPromise({
        try: async () => {
          const deployOperation = await components.deploy({
            usernameOrConnection: connection
          });

          const deployResult = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `Deploying ${components.size} component${components.size === 1 ? '' : 's'}`,
              cancellable: true
            },
            async (_, token) => {
              token.onCancellationRequested(async () => {
                await deployOperation.cancel();
                await Effect.runPromise(Fiber.interrupt(deployFiber));
              });
              await deployOperation.start();
              return await deployOperation.pollStatus();
            }
          );
          return deployResult;
        },
        catch: e => {
          console.error(e);
          return new MetadataDeployError(unknownToErrorCause(e));
        }
      }).pipe(Effect.withSpan('deploy (API call)'))
    );

    const deployOutcome = yield* Effect.matchCauseEffect(Fiber.join(deployFiber), {
      onFailure: cause =>
        Cause.isInterruptedOnly(cause)
          ? Effect.succeed(Brand.nominal<SuccessfulCancelResult>()('User canceled'))
          : Effect.failCause(cause),
      onSuccess: outcome => Effect.succeed(outcome)
    });

    if (typeof deployOutcome !== 'string') {
      yield* Effect.annotateCurrentSpan({ fileResponses: deployOutcome.getFileResponses().map(r => r.filePath) });
      yield* Effect.flatMap(SourceTrackingService, svc => svc.updateTrackingFromDeploy(deployOutcome)).pipe(
        Effect.withSpan('MetadataDeployService.updateTrackingFromDeploy')
      );
    }

    return deployOutcome;
  }).pipe(Effect.withSpan('deploy', { attributes: { componentCount: components.size } }));

/** Get required services for building ComponentSets */
const getComponentSetServices = () =>
  Effect.all(
    [
      Effect.flatMap(MetadataRegistryService, svc => svc.getRegistryAccess()),
      Effect.flatMap(ProjectService, svc => svc.getSfProject),
      Effect.flatMap(ConfigService, svc => svc.getConfigAggregator)
    ],
    { concurrency: 'unbounded' }
  );

/** Set project directory, API version, and source API version on ComponentSet */
const setComponentSetProperties = (
  componentSet: ComponentSet,
  project: SfProject,
  configAggregator: ConfigAggregator
) =>
  Effect.gen(function* () {
    componentSet.projectDirectory = project.getPath();
    const apiVersion = configAggregator.getPropertyValue<string>(OrgConfigProperties.ORG_API_VERSION);
    if (apiVersion) {
      componentSet.apiVersion = apiVersion;
    }
    const projectJson = yield* Effect.tryPromise({
      try: () => project.retrieveSfProjectJson(),
      catch: e => new FailedToResolveSfProjectError(unknownToErrorCause(e))
    });
    const sourceApiVersion = projectJson.get<string>('sourceApiVersion');
    if (sourceApiVersion) {
      componentSet.sourceApiVersion = String(sourceApiVersion);
    }
  });

/** Get ComponentSet from source paths (files/directories) */
const getComponentSetFromPaths = (paths: Set<string>) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan({ paths });
    const [registryAccess, project, configAggregator] = yield* getComponentSetServices();

    const componentSet = yield* Effect.try({
      try: () => ComponentSet.fromSource({ fsPaths: Array.from(paths), registry: registryAccess }),
      catch: e => new FailedToBuildComponentSetError(unknownToErrorCause(e))
    });

    yield* setComponentSetProperties(componentSet, project, configAggregator);

    yield* Effect.annotateCurrentSpan({ size: componentSet.size });
    return componentSet;
  }).pipe(Effect.withSpan('getComponentSetFromPaths'));

/** Get ComponentSet from manifest file */
const getComponentSetFromManifest = (manifestPath: string) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan({ manifestPath });
    const [registryAccess, project, configAggregator] = yield* getComponentSetServices();

    const componentSet = yield* Effect.tryPromise({
      try: async () =>
        ComponentSet.fromManifest({
          manifestPath,
          // Get package directories as full paths
          resolveSourcePaths: project.getPackageDirectories().map(pkgDir => pkgDir.fullPath),
          forceAddWildcards: true,
          registry: registryAccess
        }),
      catch: e => new FailedToBuildComponentSetError(unknownToErrorCause(e))
    });

    yield* setComponentSetProperties(componentSet, project, configAggregator);

    yield* Effect.annotateCurrentSpan({ size: componentSet.size });
    return componentSet;
  }).pipe(Effect.withSpan('getComponentSetFromManifest'));

export class MetadataDeployService extends Effect.Service<MetadataDeployService>()('MetadataDeployService', {
  succeed: {
    /** Deploy metadata to the default org */
    deploy,
    getComponentSetForDeploy,
    /** Build a ComponentSet from source paths (files/directories) */
    getComponentSetFromPaths,
    getComponentSetFromManifest,
    ensureNonEmptyComponentSet
  } as const
}) {}
