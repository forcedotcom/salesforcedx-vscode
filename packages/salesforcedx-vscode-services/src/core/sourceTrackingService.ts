/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DeployResult, RetrieveResult } from '@salesforce/source-deploy-retrieve';
import type { SourceTracking } from '@salesforce/source-tracking';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { SettingsService } from '../vscode/settingsService';
import { WorkspaceService } from '../vscode/workspaceService';
import { ConfigService } from './configService';
import { ConnectionService } from './connectionService';
import { defaultOrgRef } from './defaultOrgService';
import { MetadataRegistryService } from './metadataRegistryService';
import { ProjectService } from './projectService';
import { getOrgFromConnection } from './shared';

type SourceTrackingOptions = { ignoreConflicts?: boolean };

/** Creates a SourceTracking instance with optional configuration */
const getTracking = (
  options?: SourceTrackingOptions
): Effect.Effect<
  SourceTracking | undefined,
  Error,
  ConnectionService | SettingsService | ConfigService | WorkspaceService | ProjectService | MetadataRegistryService
> =>
  Effect.gen(function* () {
    const [connection, project, registryAccess, ref, configAggregator] = yield* Effect.all(
      [
        Effect.flatMap(ConnectionService, svc => svc.getConnection),
        Effect.flatMap(ProjectService, svc => svc.getSfProject),
        Effect.flatMap(MetadataRegistryService, svc => svc.getRegistryAccess()),
        SubscriptionRef.get(defaultOrgRef),
        ConfigService.pipe(Effect.flatMap(svc => svc.getConfigAggregator))
      ],
      { concurrency: 'unbounded' }
    );
    yield* Effect.annotateCurrentSpan({ supportsSourceTracking: ref.tracksSource });

    if (ref.tracksSource !== true) {
      return yield* Effect.succeed(undefined);
    }

    const [org, { SourceTracking }] = yield* Effect.all(
      [
        getOrgFromConnection(connection, configAggregator),
        Effect.promise(() => import('@salesforce/source-tracking')).pipe(
          Effect.withSpan('import @salesforce/source-tracking')
        )
      ],
      { concurrency: 'unbounded' }
    );

    return yield* Effect.tryPromise({
      try: async () =>
        SourceTracking.create({
          org,
          project,
          subscribeSDREvents: false,
          ignoreConflicts: options?.ignoreConflicts ?? false,
          registry: registryAccess
        }),
      catch: error => new Error('Failed to create SourceTracking', { cause: error })
    }).pipe(Effect.withSpan('STL create'));
  }).pipe(Effect.withSpan('getTracking'));

export class SourceTrackingService extends Effect.Service<SourceTrackingService>()('SourceTrackingService', {
  succeed: {
    getSourceTracking: (options?: SourceTrackingOptions) => getTracking(options),
    updateTrackingFromRetrieve: (result: RetrieveResult): Effect.Effect<void, Error> =>
      Effect.gen(function* () {
        yield* Effect.annotateCurrentSpan({ files: result.getFileResponses().map(r => r.filePath) });
        const tracking = yield* getTracking({ ignoreConflicts: true });
        return tracking
          ? yield* Effect.tryPromise({
              try: () => tracking.updateTrackingFromRetrieve(result),
              catch: error => {
                console.error(error);
                return new Error('Failed to update SourceTracking from retrieve', { cause: error });
              }
            }).pipe(Effect.withSpan('trackingUpdate'))
          : yield* Effect.succeed(undefined);
      }).pipe(
        Effect.withSpan('SourceTrackingService.updateTrackingFromRetrieve'),
        Effect.provide(
          Layer.mergeAll(
            ConfigService.Default,
            SettingsService.Default,
            WorkspaceService.Default,
            ProjectService.Default,
            ConnectionService.Default,
            MetadataRegistryService.Default
          )
        )
      ),
    /** safe to pass a result to.  If tracking is not enabled, this will be a no-op */
    updateTrackingFromDeploy: (result: DeployResult): Effect.Effect<void, Error> =>
      Effect.gen(function* () {
        const tracking = yield* getTracking({ ignoreConflicts: true });
        return tracking
          ? yield* Effect.all(
              [
                Effect.tryPromise({
                  try: () => tracking.updateTrackingFromDeploy(result),
                  catch: error => {
                    console.error(error);
                    return new Error('Failed to update SourceTracking from deploy', { cause: error });
                  }
                }).pipe(Effect.withSpan('trackingUpdate in STL')),
                Effect.annotateCurrentSpan({ files: result.getFileResponses().map(r => r.filePath) })
              ],
              { concurrency: 'unbounded' }
            )
          : yield* Effect.succeed(undefined);
      }).pipe(
        Effect.withSpan('SourceTrackingService.updateTrackingFromDeploy'),
        Effect.provide(
          Layer.mergeAll(
            ConfigService.Default,
            SettingsService.Default,
            WorkspaceService.Default,
            ProjectService.Default,
            ConnectionService.Default,
            MetadataRegistryService.Default
          )
        )
      )
  } as const,
  dependencies: [
    ConnectionService.Default,
    ProjectService.Default,
    ConfigService.Default,
    SettingsService.Default,
    WorkspaceService.Default,
    MetadataRegistryService.Default
  ]
}) {}
