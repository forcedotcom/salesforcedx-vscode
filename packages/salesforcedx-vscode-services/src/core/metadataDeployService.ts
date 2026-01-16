/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ComponentSet, RequestStatus } from '@salesforce/source-deploy-retrieve';
import * as Brand from 'effect/Brand';
import * as Cause from 'effect/Cause';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import { isString } from 'effect/Predicate';
import * as vscode from 'vscode';
import { SuccessfulCancelResult } from '../vscode/cancellation';
import { WorkspaceService } from '../vscode/workspaceService';
import { ConnectionService } from './connectionService';
import { ProjectService } from './projectService';
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
      yield* Effect.flatMap(SourceTrackingService, svc => svc.checkConflicts(tracking));
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

/** Deploy metadata to the default org */
const deploy = (components: ComponentSet) =>
  Effect.gen(function* () {
    const [connection, project] = yield* Effect.all(
      [
        Effect.flatMap(ConnectionService, service => service.getConnection),
        Effect.flatMap(ProjectService, service => service.getSfProject),
        Effect.flatMap(WorkspaceService, service => service.getWorkspaceInfoOrThrow),
        Effect.annotateCurrentSpan({ components: components.map(c => `${c.type.name}:${c.fullName}`) })
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

    if (typeof deployOutcome === 'string') {
      return deployOutcome;
    }
    yield* Effect.annotateCurrentSpan({ fileResponses: deployOutcome.getFileResponses().map(r => r.filePath) });
    if (deployOutcome.response?.status === RequestStatus.Succeeded) {
      yield* Effect.flatMap(SourceTrackingService, svc => svc.updateTrackingFromDeploy(deployOutcome)).pipe(
        Effect.withSpan('MetadataDeployService.updateTrackingFromDeploy')
      );
    }

    return deployOutcome;
  }).pipe(Effect.withSpan('deploy', { attributes: { componentCount: components.size } }));

export class MetadataDeployService extends Effect.Service<MetadataDeployService>()('MetadataDeployService', {
  succeed: {
    /** Deploy metadata to the default org */
    deploy,
    getComponentSetForDeploy
  } as const
}) {}
