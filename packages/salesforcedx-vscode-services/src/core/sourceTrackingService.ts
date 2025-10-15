/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Org } from '@salesforce/core';
import type { RetrieveResult } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { SettingsService } from '../vscode/settingsService';
import { WorkspaceService } from '../vscode/workspaceService';
import { ConfigService } from './configService';
import { ConnectionService } from './connectionService';
import { MetadataRegistryService } from './metadataRegistryService';
import { ProjectService } from './projectService';

const getTracking = Effect.gen(function* () {
  const [connection, project, registryAccess] = yield* Effect.all(
    [
      Effect.flatMap(ConnectionService, svc => svc.getConnection),
      Effect.flatMap(ProjectService, svc => svc.getSfProject),
      Effect.flatMap(MetadataRegistryService, svc => svc.getRegistryAccess())
    ],
    { concurrency: 'unbounded' }
  );

  const org = yield* Effect.tryPromise({
    try: () => Org.create({ connection }),
    catch: error => new Error('Failed to create Org', { cause: error })
  }).pipe(Effect.withSpan('Org.create'));

  // TODO: can we read this from the ref instead of calling the method?
  const supportsSourceTracking = yield* Effect.promise(() => org.supportsSourceTracking()).pipe(
    Effect.catchAll(error => Effect.logError('Source Tracking check error', { cause: error }).pipe(Effect.as(false))),
    Effect.withSpan('org.supportsSourceTracking')
  );

  yield* Effect.annotateCurrentSpan({ attributes: { supportsSourceTracking } });

  if (!supportsSourceTracking) {
    yield* Effect.succeed(undefined);
  }

  return yield* Effect.tryPromise({
    try: async () => {
      const { SourceTracking } = await import('@salesforce/source-tracking');
      return SourceTracking.create({
        org,
        project,
        ignoreLocalCache: true,
        subscribeSDREvents: false,
        ignoreConflicts: true,
        registry: registryAccess
      });
    },
    catch: error => new Error('Failed to create SourceTracking', { cause: error })
  }).pipe(Effect.withSpan('STL import and create'));
}).pipe(Effect.withSpan('getTracking'));

export class SourceTrackingService extends Effect.Service<SourceTrackingService>()('SourceTrackingService', {
  succeed: {
    getSourceTracking: getTracking,
    updateTrackingFromRetrieve: (result: RetrieveResult): Effect.Effect<void, Error> =>
      Effect.gen(function* () {
        yield* Effect.annotateCurrentSpan({ files: result.getFileResponses().map(r => r.filePath) });
        const tracking = yield* getTracking;
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
        Effect.withSpan('updateTrackingFromRetrieve'),
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
