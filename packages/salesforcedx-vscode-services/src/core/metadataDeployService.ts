/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type DeployResult, ComponentSet } from '@salesforce/source-deploy-retrieve';
import { type SourceTracking } from '@salesforce/source-tracking';
import * as Brand from 'effect/Brand';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as vscode from 'vscode';
import { SuccessfulCancelResult } from '../vscode/cancellation';
import { ChannelService } from '../vscode/channelService';
import { SettingsService } from '../vscode/settingsService';
import { WorkspaceService } from '../vscode/workspaceService';
import { ConfigService } from './configService';
import { ConnectionService } from './connectionService';
import { MetadataRegistryService } from './metadataRegistryService';
import { ProjectService } from './projectService';
import { type SourceTrackingOptions, SourceTrackingService } from './sourceTrackingService';

/** Get ComponentSet of local changes for deploy */
const getComponentSetForDeploy = (
  options?: SourceTrackingOptions
): Effect.Effect<
  ComponentSet,
  Error,
  | ConnectionService
  | SettingsService
  | ConfigService
  | WorkspaceService
  | ProjectService
  | MetadataRegistryService
  | SourceTrackingService
  | ChannelService
> =>
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

    return localComponentSets[0] ?? new ComponentSet();
  }).pipe(Effect.withSpan('getComponentSetForDeploy'));

const conflictCheck = (tracking: SourceTracking): Effect.Effect<void, Error, ChannelService> =>
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
const deploy = (
  components: ComponentSet
): Effect.Effect<
  DeployResult | SuccessfulCancelResult,
  Error,
  | ConnectionService
  | ProjectService
  | WorkspaceService
  | ConfigService
  | SettingsService
  | MetadataRegistryService
  | SourceTrackingService
> =>
  Effect.gen(function* () {
    const [connection, project, workspaceDescription] = yield* Effect.all(
      [
        Effect.flatMap(ConnectionService, service => service.getConnection),
        Effect.flatMap(ProjectService, service => service.getSfProject),
        Effect.flatMap(WorkspaceService, service => service.getWorkspaceInfo),
        Effect.annotateCurrentSpan({ components: components.size })
      ],
      { concurrency: 'unbounded' }
    );

    if (workspaceDescription.isEmpty) {
      return yield* Effect.fail(new Error('No workspace path found'));
    }

    components.projectDirectory = project.getDefaultPackage().fullPath;

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
          return new Error('Failed to deploy metadata', { cause: e });
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
      yield* Effect.flatMap(SourceTrackingService, svc => svc.updateTrackingFromDeploy(deployOutcome)).pipe(
        Effect.withSpan('MetadataDeployService.updateTrackingFromDeploy')
      );
    }

    return deployOutcome;
  }).pipe(Effect.withSpan('deploy', { attributes: { componentCount: components.size } }));

export class MetadataDeployService extends Effect.Service<MetadataDeployService>()('MetadataDeployService', {
  succeed: {
    /**
     * Deploy metadata to the default org.
     * @param components - ComponentSet to deploy
     * @returns Effect that resolves to SDR's DeployResult
     */
    deploy,
    getComponentSetForDeploy
  } as const
}) {}
