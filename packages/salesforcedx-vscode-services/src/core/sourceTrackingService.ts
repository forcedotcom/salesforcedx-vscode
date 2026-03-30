/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DeployResult, RetrieveResult } from '@salesforce/source-deploy-retrieve';
import { type SourceTracking } from '@salesforce/source-tracking';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
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
const toSourceTrackingError = (error: unknown) => new SourceTrackingError({ cause: unknownToErrorCause(error).cause });

export class SourceTrackingService extends Effect.Service<SourceTrackingService>()('SourceTrackingService', {
  accessors: true,
  dependencies: [
    ConnectionService.Default,
    ProjectService.Default,
    ConfigService.Default,
    SettingsService.Default,
    WorkspaceService.Default,
    MetadataRegistryService.Default
  ],
  effect: Effect.gen(function* () {
    const connectionService = yield* ConnectionService;
    const projectService = yield* ProjectService;
    const configService = yield* ConfigService;
    const metadataRegistryService = yield* MetadataRegistryService;

    // Semaphores for concurrency control (1 permit each for sequential access)
    const localSemaphore = yield* Effect.makeSemaphore(1);
    const remoteSemaphore = yield* Effect.makeSemaphore(1);

    // Lazy singleton for SourceTracking instance with org ID validation
    const trackingRef = yield* Ref.make<Option.Option<{ tracking: SourceTracking; orgId: string }>>(Option.none());

    /** Gets or creates the SourceTracking singleton. Validates cached instance matches current org. Throws SourceTrackingNotEnabledError if tracking is not enabled. */
    const getOrCreateTracking = Effect.fn('SourceTrackingService.getOrCreateTracking')(function* () {
      const cached = yield* Ref.get(trackingRef);
      const ref = yield* SubscriptionRef.get(yield* getDefaultOrgRef());
      const currentOrgId = ref.orgId;

      // Check if cached instance matches current org
      if (Option.isSome(cached) && cached.value.orgId === currentOrgId) {
        return cached.value.tracking;
      }

      // Different org or no cache - create new instance
      const tracking = yield* getTracking();
      if (!tracking) {
        return yield* new SourceTrackingNotEnabledError({ message: 'Source tracking is not enabled' });
      }

      // Cache it with current org ID
      if (currentOrgId) {
        yield* Ref.set(trackingRef, Option.some({ tracking, orgId: currentOrgId }));
      }
      return tracking;
    });

    /** Creates a SourceTracking instance with optional configuration.  Returns undefined if source tracking is not enabled */
    const getTracking = Effect.fn('SourceTrackingService.getTracking')(function* (options?: SourceTrackingOptions) {
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
        return yield* Effect.void;
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
        catch: toSourceTrackingError
      }).pipe(Effect.withSpan('STL create'));
    });

    /** Checks if source tracking is enabled without creating an instance */
    const hasTracking = Effect.fn('SourceTrackingService.hasTracking')(function* () {
      const ref = yield* SubscriptionRef.get(yield* getDefaultOrgRef());
      return ref.tracksSource === true;
    });

    /** Helper: Re-read local tracking with error handling */
    const rereadLocal = (tracking: SourceTracking) =>
      Effect.tryPromise({
        try: () => tracking.reReadLocalTrackingCache(),
        catch: toSourceTrackingError
      }).pipe(Effect.withSpan('STL.ReReadLocalTrackingCache'));

    /** Helper: Re-read remote tracking with error handling */
    const rereadRemote = (tracking: SourceTracking) =>
      Effect.tryPromise({
        try: () => tracking.reReadRemoteTracking(),
        catch: toSourceTrackingError
      }).pipe(Effect.withSpan('STL.ReReadRemoteTracking'));

    /** Helper: Re-read both local and remote tracking with error handling */
    const rereadBoth = (tracking: SourceTracking) =>
      Effect.all([rereadLocal(tracking), rereadRemote(tracking)], { concurrency: 'unbounded' });

    /** Get local changes as ComponentSet array (local tracking files only) */
    const getLocalChangesAsComponentSet = Effect.fn('SourceTrackingService.getLocalChangesAsComponentSet')(
      function* () {
        const tracking = yield* getOrCreateTracking();

        return yield* localSemaphore.withPermits(1)(
          Effect.gen(function* () {
            yield* rereadLocal(tracking);
            return yield* Effect.tryPromise({
              try: () => tracking.localChangesAsComponentSet(false),
              catch: toSourceTrackingError
            }).pipe(Effect.withSpan('STL.LocalChangesAsComponentSet'));
          })
        );
      }
    );

    /** Get remote non-deletes as ComponentSet (remote tracking files only) */
    const getRemoteNonDeletesAsComponentSet = Effect.fn('SourceTrackingService.getRemoteNonDeletesAsComponentSet')(
      function* (options: { applyIgnore: boolean }) {
        const tracking = yield* getOrCreateTracking();

        return yield* remoteSemaphore.withPermits(1)(
          Effect.gen(function* () {
            yield* rereadRemote(tracking);
            return yield* Effect.tryPromise({
              try: () => tracking.remoteNonDeletesAsComponentSet(options),
              catch: toSourceTrackingError
            }).pipe(Effect.withSpan('STL.RemoteNonDeletesAsComponentSet'));
          })
        );
      }
    );

    /** Reset remote tracking (remote tracking files only) */
    const resetRemoteTracking = Effect.fn('SourceTrackingService.resetRemoteTracking')(function* () {
      const tracking = yield* getOrCreateTracking();

      return yield* remoteSemaphore.withPermits(1)(
        Effect.tryPromise({
          try: () => tracking.resetRemoteTracking(),
          catch: toSourceTrackingError
        }).pipe(Effect.withSpan('STL.ResetRemoteTracking'))
      );
    });

    /** Get status of local and/or remote changes (acquires semaphores based on options) */
    const getStatus = Effect.fn('SourceTrackingService.getStatus')(function* (options:
      | { local: true; remote?: never }
      | { remote: true; local?: never }
      | { local: true; remote: true }
    ) {
      const tracking = yield* getOrCreateTracking();

      // Take only the permits we need, concurrently
      yield* Effect.all(
        [options.local ? localSemaphore.take(1) : Effect.void, options.remote ? remoteSemaphore.take(1) : Effect.void],
        { concurrency: 'unbounded' }
      );

      return yield* Effect.gen(function* () {
        yield* Effect.all(
          [...(options.local ? [rereadLocal(tracking)] : []), ...(options.remote ? [rereadRemote(tracking)] : [])],
          { concurrency: 'unbounded' }
        );

        return yield* Effect.tryPromise({
          try: () => tracking.getStatus({ local: options.local === true, remote: options.remote === true }),
          catch: toSourceTrackingError
        }).pipe(Effect.withSpan('STL.GetStatus'));
      }).pipe(
        Effect.ensuring(
          Effect.all(
            [
              options.local ? localSemaphore.release(1) : Effect.void,
              options.remote ? remoteSemaphore.release(1) : Effect.void
            ],
            { concurrency: 'unbounded' }
          )
        )
      );
    });

    /** Apply remote deletes to local and get non-deletes component set (both tracking files) */
    const maybeApplyRemoteDeletesToLocal = Effect.fn('SourceTrackingService.maybeApplyRemoteDeletesToLocal')(function* (
      apply: true
    ) {
      const tracking = yield* getOrCreateTracking();

      return yield* localSemaphore.withPermits(1)(
        remoteSemaphore.withPermits(1)(
          Effect.gen(function* () {
            yield* rereadBoth(tracking);
            return yield* Effect.tryPromise({
              try: () => tracking.maybeApplyRemoteDeletesToLocal(apply),
              catch: toSourceTrackingError
            }).pipe(Effect.withSpan('STL.MaybeApplyRemoteDeletesToLocal'));
          })
        )
      );
    });

    /** Get conflicts without UI side effects (both tracking files) */
    const getConflicts = Effect.fn('SourceTrackingService.getConflicts')(function* () {
      const tracking = yield* getOrCreateTracking();

      return yield* localSemaphore.withPermits(1)(
        remoteSemaphore.withPermits(1)(
          Effect.gen(function* () {
            yield* rereadBoth(tracking);
            return yield* Effect.tryPromise({
              try: () => tracking.getConflicts(),
              catch: toSourceTrackingError
            }).pipe(Effect.withSpan('STL.GetConflicts'));
          })
        )
      );
    });

    /** Check for conflicts and display them in the channel, failing if conflicts are found (both tracking files) */
    const checkConflicts = Effect.fn('SourceTrackingService.checkConflicts')(function* () {
      const conflicts = yield* getConflicts();

      if (!conflicts?.length) {
        return yield* Effect.void;
      }
      yield* Effect.annotateCurrentSpan({
        conflicts: true
      });
      const channelService = yield* ChannelService;
      const conflictDetails = conflicts.map(c => `${c.type}:${c.name} (${(c.filenames ?? []).join(', ')})`);
      yield* channelService.appendToChannel(
        ['Conflicts detected', ...conflictDetails.map(detail => `  ${detail}`)].join('\n')
      );
      const channel = yield* channelService.getChannel;
      channel.show();
      return yield* new SourceTrackingConflictError({ conflicts: conflictDetails });
    });

    /** Maybe update tracking from retrieve result (both tracking files). No-op if tracking is not enabled. */
    const maybeUpdateTrackingFromRetrieve = Effect.fn('SourceTrackingService.maybeUpdateTrackingFromRetrieve')(
      function* (result: RetrieveResult) {
        yield* Effect.annotateCurrentSpan({ files: result.getFileResponses().map(r => r.filePath) });

        // Check if tracking is enabled before attempting to get instance
        const enabled = yield* hasTracking();
        if (!enabled) {
          return yield* Effect.void;
        }

        const tracking = yield* getOrCreateTracking();
        return yield* localSemaphore.withPermits(1)(
          remoteSemaphore.withPermits(1)(
            Effect.tryPromise({
              try: () => tracking.updateTrackingFromRetrieve(result),
              catch: toSourceTrackingError
            }).pipe(
              Effect.withSpan('STL.UpdateTrackingFromRetrieve'),
              Effect.tapError(error => Effect.logError(error))
            )
          )
        );
      }
    );

    /** Maybe update tracking from deploy result (both tracking files). No-op if tracking is not enabled. */
    const maybeUpdateTrackingFromDeploy = Effect.fn('SourceTrackingService.maybeUpdateTrackingFromDeploy')(function* (
      result: DeployResult
    ) {
      // Check if tracking is enabled before attempting to get instance
      const enabled = yield* hasTracking();
      if (!enabled) {
        return yield* Effect.void;
      }

      const tracking = yield* getOrCreateTracking();
      return yield* Effect.all(
        [
          localSemaphore.withPermits(1)(
            remoteSemaphore.withPermits(1)(
              Effect.tryPromise({
                try: () => tracking.updateTrackingFromDeploy(result),
                catch: toSourceTrackingError
              }).pipe(
                Effect.withSpan('STL.UpdateTrackingFromDeploy'),
                Effect.tapError(error => Effect.logError(error))
              )
            )
          ),
          Effect.annotateCurrentSpan({ files: result.getFileResponses().map(r => r.filePath) })
        ],
        { concurrency: 'unbounded' }
      );
    });

    return {
      /** Check if source tracking is enabled for the current org without creating a tracking instance */
      hasTracking,

      /** Get local changes as ComponentSet (auto-rereads local tracking) */
      getLocalChangesAsComponentSet,

      /** Get remote non-deletes as ComponentSet (auto-rereads remote tracking) */
      getRemoteNonDeletesAsComponentSet,

      /** Reset remote tracking files */
      resetRemoteTracking,

      /** Get status of local and/or remote changes (auto-rereads based on options) */
      getStatus,

      /** Apply remote deletes to local and return non-deletes ComponentSet (auto-rereads both) */
      maybeApplyRemoteDeletesToLocal,

      /** Get conflicts without UI side effects (auto-rereads both) */
      getConflicts,

      /** Check for conflicts and display them in the channel, failing if found (auto-rereads both) */
      checkConflicts,

      /** Update tracking from retrieve result. No-op if tracking is disabled. */
      maybeUpdateTrackingFromRetrieve,

      /** Update tracking from deploy result. No-op if tracking is disabled. */
      maybeUpdateTrackingFromDeploy
    };
  })
}) {}
