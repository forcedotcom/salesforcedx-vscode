/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DeployResult, RetrieveResult } from '@salesforce/source-deploy-retrieve';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { SettingsService } from '../vscode/settingsService';
import { WorkspaceService } from '../vscode/workspaceService';
import { ConfigService } from './configService';
import { ConnectionService } from './connectionService';
import { defaultOrgRef } from './defaultOrgService';
import { MetadataRegistryService } from './metadataRegistryService';
import { ProjectService } from './projectService';
import { getOrgFromConnection, unknownToErrorCause } from './shared';

export type SourceTrackingOptions = { ignoreConflicts?: boolean };
export class SourceTrackingError extends Data.TaggedError('FailedToUpdateSourceTrackingError')<{
  readonly cause: unknown;
}> {}

export class SourceTrackingNotEnabledError extends Data.TaggedError('SourceTrackingNotEnabledError')<{
  readonly message: string;
}> {}
/** Gets a SourceTracking instance with optional configuration.  Throws a SourceTrackingNotEnabledError if source tracking is not enabled */
const getTrackingOrThrow = (options?: SourceTrackingOptions) =>
  Effect.gen(function* () {
    const tracking = yield* getTracking(options);
    if (!tracking) {
      return yield* Effect.fail(new SourceTrackingNotEnabledError({ message: 'Source tracking is not enabled' }));
    }
    return tracking;
  });
/** Creates a SourceTracking instance with optional configuration.  Returns undefined if source tracking is not enabled */
const getTracking = (options?: SourceTrackingOptions) =>
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
    yield* Effect.annotateCurrentSpan({
      supportsSourceTracking: ref.tracksSource,
      ignoreConflicts: options?.ignoreConflicts
    });

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
      catch: error => new SourceTrackingError(unknownToErrorCause(error))
    }).pipe(Effect.withSpan('STL create'));
  }).pipe(Effect.withSpan('getTracking'));

/** safe to pass a result to.  If tracking is not enabled, this will be a no-op */
const updateTrackingFromRetrieve = (result: RetrieveResult) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan({ files: result.getFileResponses().map(r => r.filePath) });
    const tracking = yield* getTracking({ ignoreConflicts: true });
    return tracking
      ? yield* Effect.tryPromise({
          try: () => tracking.updateTrackingFromRetrieve(result),
          catch: error => {
            console.error(error);
            return new SourceTrackingError(unknownToErrorCause(error));
          }
        }).pipe(Effect.withSpan('trackingUpdate'))
      : yield* Effect.succeed(undefined);
  }).pipe(Effect.withSpan('SourceTrackingService.updateTrackingFromRetrieve'));

/** safe to pass a result to.  If tracking is not enabled, this will be a no-op */
const updateTrackingFromDeploy = (result: DeployResult) =>
  Effect.gen(function* () {
    const tracking = yield* getTracking({ ignoreConflicts: true });
    return tracking
      ? yield* Effect.all(
          [
            Effect.tryPromise({
              try: () => tracking.updateTrackingFromDeploy(result),
              catch: error => {
                console.error(error);
                return new SourceTrackingError(unknownToErrorCause(error));
              }
            }).pipe(Effect.withSpan('trackingUpdate in STL')),
            Effect.annotateCurrentSpan({ files: result.getFileResponses().map(r => r.filePath) })
          ],
          { concurrency: 'unbounded' }
        )
      : yield* Effect.succeed(undefined);
  }).pipe(Effect.withSpan('SourceTrackingService.updateTrackingFromDeploy'));

export class SourceTrackingService extends Effect.Service<SourceTrackingService>()('SourceTrackingService', {
  succeed: {
    getSourceTrackingOrThrow: (options?: SourceTrackingOptions) => getTrackingOrThrow(options),
    getSourceTracking: (options?: SourceTrackingOptions) => getTracking(options),
    updateTrackingFromRetrieve,
    updateTrackingFromDeploy
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
