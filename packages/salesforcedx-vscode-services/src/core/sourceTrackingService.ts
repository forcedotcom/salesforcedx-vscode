/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DeployResult, RetrieveResult } from '@salesforce/source-deploy-retrieve';
import { type SourceTracking } from '@salesforce/source-tracking';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { ChannelService } from '../vscode/channelService';
import { SettingsService } from '../vscode/settingsService';
import { WorkspaceService } from '../vscode/workspaceService';
import { ConfigService } from './configService';
import { ConnectionService } from './connectionService';
import { getDefaultOrgRef } from './defaultOrgRef';
import { MetadataRegistryService } from './metadataRegistryService';
import { ProjectService } from './projectService';
import { getOrgFromConnection, unknownToErrorCause } from './shared';

export type SourceTrackingOptions = { ignoreConflicts?: boolean };
export class SourceTrackingError extends Schema.TaggedError<SourceTrackingError>()('SourceTrackingError', {
  cause: Schema.Unknown
}) {}

export class SourceTrackingNotEnabledError extends Schema.TaggedError<SourceTrackingNotEnabledError>()(
  'SourceTrackingNotEnabledError',
  {
    message: Schema.String
  }
) {}

export class SourceTrackingConflictError extends Schema.TaggedError<SourceTrackingConflictError>()(
  'SourceTrackingConflictError',
  {
    conflicts: Schema.Array(Schema.String)
  }
) {}
export class SourceTrackingService extends Effect.Service<SourceTrackingService>()('SourceTrackingService', {
  accessors: true,
  dependencies: [
    ConnectionService.Default,
    ProjectService.Default,
    ConfigService.Default,
    SettingsService.Default,
    WorkspaceService.Default,
    MetadataRegistryService.Default,
    ChannelService.Default
  ],
  effect: Effect.gen(function* () {
    const channelService = yield* ChannelService;
    const connectionService = yield* ConnectionService;
    const projectService = yield* ProjectService;
    const configService = yield* ConfigService;
    const metadataRegistryService = yield* MetadataRegistryService;

    /** Creates a SourceTracking instance with optional configuration.  Returns undefined if source tracking is not enabled */
    const getTracking = (options?: SourceTrackingOptions) =>
      Effect.gen(function* () {
        const [connection, project, registryAccess, ref, configAggregator] = yield* Effect.all(
          [
            connectionService.getConnection(),
            projectService.getSfProject(),
            metadataRegistryService.getRegistryAccess(),
            SubscriptionRef.get(yield* getDefaultOrgRef()),
            configService.getConfigAggregator()
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
          catch: error => new SourceTrackingError({ cause: unknownToErrorCause(error).cause })
        }).pipe(Effect.withSpan('STL create'));
      }).pipe(Effect.withSpan('getTracking'));

    /** Gets a SourceTracking instance with optional configuration.  Throws a SourceTrackingNotEnabledError if source tracking is not enabled */
    const getSourceTrackingOrThrow = Effect.fn('SourceTrackingService.getSourceTrackingOrThrow')(function* (
      options?: SourceTrackingOptions
    ) {
      const tracking = yield* getTracking(options);
      if (!tracking) {
        return yield* Effect.fail(new SourceTrackingNotEnabledError({ message: 'Source tracking is not enabled' }));
      }
      return tracking;
    });

    /** Creates a SourceTracking instance with optional configuration.  Returns undefined if source tracking is not enabled */
    const getSourceTracking = Effect.fn('SourceTrackingService.getSourceTracking')(function* (
      options?: SourceTrackingOptions
    ) {
      return yield* getTracking(options);
    });

    /** Check for conflicts and display them in the channel, failing if conflicts are found */
    const checkConflicts = Effect.fn('SourceTrackingService.checkConflicts')(function* (tracking: SourceTracking) {
      const conflicts = yield* Effect.tryPromise({
        try: () => tracking.getConflicts(),
        catch: error => new SourceTrackingError({ cause: unknownToErrorCause(error).cause })
      }).pipe(Effect.withSpan('STL.GetConflicts'));

      if (!conflicts?.length) {
        return yield* Effect.succeed(undefined);
      }
      yield* Effect.annotateCurrentSpan({
        conflicts: true
      });
      const conflictDetails = conflicts.map(c => `${c.type}:${c.name} (${(c.filenames ?? []).join(', ')})`);
      yield* channelService.appendToChannel(
        ['Conflicts detected', ...conflictDetails.map(detail => `  ${detail}`)].join('\n')
      );
      const channel = yield* channelService.getChannel;
      channel.show();
      return yield* Effect.fail(
        new SourceTrackingConflictError({
          conflicts: conflictDetails
        })
      );
    });

    /** safe to pass a result to.  If tracking is not enabled, this will be a no-op */
    const updateTrackingFromRetrieve = Effect.fn('SourceTrackingService.updateTrackingFromRetrieve')(function* (
      result: RetrieveResult
    ) {
      yield* Effect.annotateCurrentSpan({ files: result.getFileResponses().map(r => r.filePath) });
      const tracking = yield* getTracking({ ignoreConflicts: true });
      return tracking
        ? yield* Effect.tryPromise({
            try: () => tracking.updateTrackingFromRetrieve(result),
            catch: error => new SourceTrackingError({ cause: unknownToErrorCause(error).cause })
          }).pipe(
            Effect.withSpan('trackingUpdate'),
            Effect.tapError(error => Effect.logError(error))
          )
        : yield* Effect.succeed(undefined);
    });

    /** safe to pass a result to.  If tracking is not enabled, this will be a no-op */
    const updateTrackingFromDeploy = Effect.fn('SourceTrackingService.updateTrackingFromDeploy')(function* (
      result: DeployResult
    ) {
      const tracking = yield* getTracking({ ignoreConflicts: true });
      return tracking
        ? yield* Effect.all(
            [
              Effect.tryPromise({
                try: () => tracking.updateTrackingFromDeploy(result),
                catch: error => new SourceTrackingError({ cause: unknownToErrorCause(error).cause })
              })
                .pipe(Effect.withSpan('trackingUpdate in STL'))
                .pipe(Effect.tapError(error => Effect.logError(error))),
              Effect.annotateCurrentSpan({ files: result.getFileResponses().map(r => r.filePath) })
            ],
            { concurrency: 'unbounded' }
          )
        : yield* Effect.succeed(undefined);
    });

    return {
      getSourceTrackingOrThrow,
      getSourceTracking,
      checkConflicts,
      updateTrackingFromRetrieve,
      updateTrackingFromDeploy
    };
  })
}) {}
