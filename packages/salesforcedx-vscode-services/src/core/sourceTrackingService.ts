/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ComponentSet,
  ComponentStatus,
  type DeployResult,
  type FileResponse,
  type RetrieveResult
} from '@salesforce/source-deploy-retrieve';
import { ChangeResult, type SourceTracking } from '@salesforce/source-tracking';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { normalize } from 'node:path';
import { OrgMetadataCatalogRecorder } from '../orgCatalog/orgMetadataCatalogRecorder';
import { ChannelService } from '../vscode/channelService';
import { SettingsService } from '../vscode/settingsService';
import { WorkspaceService } from '../vscode/workspaceService';
import { ConfigService } from './configService';
import { ConnectionService } from './connectionService';
import { getDefaultOrgRef } from './defaultOrgRef';
import { MetadataDescribeService } from './metadataDescribeService';
import { MetadataRegistryService } from './metadataRegistryService';
import { ProjectService } from './projectService';
import { getOrgFromConnection, unknownToErrorCause } from './shared';
import { releaseSourceTrackingShadowRepo } from './sourceTrackingShadowRepoLifecycle';

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

const ResolvedChangeResultSchema = Schema.Struct({ name: Schema.String, type: Schema.String });
type SourceTrackingRemoteChange = ChangeResult & Schema.Schema.Type<typeof ResolvedChangeResultSchema>;
const isResolvedChangeResult = (c: ChangeResult): c is SourceTrackingRemoteChange =>
  Schema.is(ResolvedChangeResultSchema)(c);

export class SourceTrackingService extends Effect.Service<SourceTrackingService>()('SourceTrackingService', {
  accessors: true,
  dependencies: [
    ConnectionService.Default,
    ProjectService.Default,
    ConfigService.Default,
    SettingsService.Default,
    WorkspaceService.Default,
    MetadataRegistryService.Default,
    MetadataDescribeService.Default,
    OrgMetadataCatalogRecorder.Default
  ],
  effect: Effect.gen(function* () {
    const connectionService = yield* ConnectionService;
    const projectService = yield* ProjectService;
    const configService = yield* ConfigService;
    const metadataRegistryService = yield* MetadataRegistryService;
    const metadataDescribeService = yield* MetadataDescribeService;
    const catalogRecorder = yield* OrgMetadataCatalogRecorder;

    // Semaphores for concurrency control (1 permit each for sequential access)
    const localSemaphore = yield* Effect.makeSemaphore(1);
    const remoteSemaphore = yield* Effect.makeSemaphore(1);
    const trackingCreationSemaphore = yield* Effect.makeSemaphore(1);

    // Lazy singleton for SourceTracking instance with org ID validation
    const trackingRef = yield* Ref.make<Option.Option<{ tracking: SourceTracking; orgId: string }>>(Option.none());

    /** Gets or creates the SourceTracking singleton. Validates cached instance matches current org. Throws SourceTrackingNotEnabledError if tracking is not enabled. */
    const getOrCreateTracking = Effect.fn('SourceTrackingService.getOrCreateTracking')(function* (
      expectedOrgId?: string
    ) {
      const cached = yield* Ref.get(trackingRef);
      const currentOrgId = expectedOrgId ?? (yield* SubscriptionRef.get(yield* getDefaultOrgRef())).orgId;

      // Check if cached instance matches current org
      if (Option.isSome(cached) && cached.value.orgId === currentOrgId) {
        return cached.value.tracking;
      }

      // Source Tracking's local ShadowRepo singleton is keyed only by project
      // path. Release it before constructing tracking for a different org.
      yield* projectService.getSfProject().pipe(
        Effect.map(project => normalize(project.getPath())),
        Effect.flatMap(projectPath => Effect.sync(() => releaseSourceTrackingShadowRepo(projectPath))),
        Effect.tap(releasedShadowRepo => Effect.annotateCurrentSpan({ currentOrgId, releasedShadowRepo }))
      );

      // Different org or no cache - create new instance
      const tracking = yield* getTracking(undefined, expectedOrgId);
      if (!tracking) {
        return yield* new SourceTrackingNotEnabledError({ message: 'Source tracking is not enabled' });
      }

      // Cache it with current org ID
      if (currentOrgId) {
        yield* Ref.set(trackingRef, Option.some({ tracking, orgId: currentOrgId }));
      }
      return tracking;
    }, trackingCreationSemaphore.withPermits(1));

    /** Creates a SourceTracking instance with optional configuration.  Returns undefined if source tracking is not enabled */
    const getTracking = Effect.fn('SourceTrackingService.getTracking')(function* (
      options?: SourceTrackingOptions,
      expectedOrgId?: string
    ) {
      const [connection, project, registryAccess, ref, configAggregator] = yield* Effect.all(
        [
          expectedOrgId ? connectionService.getConnectionForOrg(expectedOrgId) : connectionService.getConnection(),
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
    const hasTracking = Effect.fn('SourceTrackingService.hasTracking')(function* (expectedOrgId?: string) {
      if (expectedOrgId) yield* connectionService.getConnectionForOrg(expectedOrgId);
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
    const getLocalChangesAsComponentSet = Effect.fn('SourceTrackingService.getLocalChangesAsComponentSet')(() =>
      getOrCreateTracking().pipe(
        Effect.tap(rereadLocal),
        Effect.flatMap(tracking =>
          Effect.tryPromise({
            try: () => tracking.localChangesAsComponentSet(false),
            catch: toSourceTrackingError
          }).pipe(Effect.withSpan('STL.LocalChangesAsComponentSet'))
        ),
        localSemaphore.withPermits(1)
      )
    );

    /** Get remote non-deletes as ComponentSet (remote tracking files only) */
    const getRemoteNonDeletesAsComponentSet = Effect.fn('SourceTrackingService.getRemoteNonDeletesAsComponentSet')(
      (options: { applyIgnore: boolean }) =>
        getOrCreateTracking().pipe(
          Effect.tap(rereadRemote),
          Effect.flatMap(tracking =>
            Effect.tryPromise({
              try: () => tracking.remoteNonDeletesAsComponentSet(options),
              catch: toSourceTrackingError
            }).pipe(Effect.withSpan('STL.RemoteNonDeletesAsComponentSet'))
          ),
          remoteSemaphore.withPermits(1)
        )
    );

    /** Get remote deletes as ComponentSet (remote tracking files only).
     * Uses ChangeResult format (not SourceComponent) so it returns entries even when local files don't exist. */
    const getRemoteDeletesAsComponentSet = Effect.fn('SourceTrackingService.getRemoteDeletesAsComponentSet')(() =>
      metadataRegistryService.getRegistryAccess().pipe(
        Effect.flatMap(registry =>
          getOrCreateTracking().pipe(
            Effect.tap(rereadRemote),
            Effect.flatMap(tracking =>
              Effect.tryPromise({
                try: () => tracking.getChanges({ origin: 'remote', state: 'delete', format: 'ChangeResult' }),
                catch: toSourceTrackingError
              }).pipe(Effect.withSpan('STL.RemoteDeletesAsComponentSet'))
            ),
            Effect.map(
              changeResults =>
                new ComponentSet(
                  changeResults.filter(isResolvedChangeResult).map(c => ({ type: c.type, fullName: c.name })),
                  registry
                )
            ),
            remoteSemaphore.withPermits(1)
          )
        )
      )
    );

    /** Reset remote tracking (remote tracking files only) */
    const resetRemoteTracking = Effect.fn('SourceTrackingService.resetRemoteTracking')(() =>
      getOrCreateTracking().pipe(
        Effect.flatMap(tracking =>
          Effect.tryPromise({
            try: () => tracking.resetRemoteTracking(),
            catch: toSourceTrackingError
          }).pipe(Effect.withSpan('STL.ResetRemoteTracking'))
        ),
        remoteSemaphore.withPermits(1)
      )
    );

    /** Read status and revision-bearing remote observations from one tracking refresh. */
    const getStatusWithRemoteChanges = Effect.fn('SourceTrackingService.getStatusWithRemoteChanges')(
      function* (
        options: { local: true; remote?: never } | { remote: true; local?: never } | { local: true; remote: true },
        expectedOrgId?: string
      ) {
        const tracking = yield* getOrCreateTracking(expectedOrgId);
        yield* Effect.all(
          [...(options.local ? [rereadLocal(tracking)] : []), ...(options.remote ? [rereadRemote(tracking)] : [])],
          { concurrency: 'unbounded' }
        );

        const status = yield* Effect.tryPromise({
          try: () => tracking.getStatus({ local: options.local === true, remote: options.remote === true }),
          catch: toSourceTrackingError
        }).pipe(Effect.withSpan('STL.GetStatus'));
        const remoteChanges = yield* options.remote
          ? Effect.all(
              [
                Effect.tryPromise({
                  try: () => tracking.getChanges({ origin: 'remote', state: 'nondelete', format: 'ChangeResult' }),
                  catch: toSourceTrackingError
                }),
                Effect.tryPromise({
                  try: () => tracking.getChanges({ origin: 'remote', state: 'delete', format: 'ChangeResult' }),
                  catch: toSourceTrackingError
                })
              ],
              { concurrency: 1 }
            ).pipe(Effect.map(changes => changes.flat().filter(isResolvedChangeResult)))
          : Effect.succeed<SourceTrackingRemoteChange[]>([]);
        yield* Effect.annotateCurrentSpan({ remoteChangeRows: remoteChanges.length, statusRows: status.length });
        return { remoteChanges, status };
      },
      (effect, options) =>
        Effect.acquireUseRelease(
          Effect.all(
            [
              options.local ? localSemaphore.take(1) : Effect.void,
              options.remote ? remoteSemaphore.take(1) : Effect.void
            ],
            { concurrency: 'unbounded' }
          ),
          () => effect,
          () =>
            Effect.all(
              [
                options.local ? localSemaphore.release(1) : Effect.void,
                options.remote ? remoteSemaphore.release(1) : Effect.void
              ],
              { concurrency: 'unbounded' }
            )
        )
    );

    /** Get status of local and/or remote changes (acquires semaphores based on options). */
    const getStatus = Effect.fn('SourceTrackingService.getStatus')(function* (
      options: { local: true; remote?: never } | { remote: true; local?: never } | { local: true; remote: true },
      expectedOrgId?: string
    ) {
      const result = yield* getStatusWithRemoteChanges(options, expectedOrgId);
      if (options.remote) {
        const { orgId: activeOrgId } = yield* SubscriptionRef.get(yield* getDefaultOrgRef());
        const orgId =
          expectedOrgId ?? activeOrgId ?? (yield* connectionService.getConnection()).getAuthInfoFields().orgId;
        if (orgId) {
          const changedReferences = yield* catalogRecorder.recordTrackingStatus(
            orgId,
            result.status,
            result.remoteChanges
          );
          yield* metadataDescribeService.invalidateForMetadataChanges(orgId, changedReferences);
        }
      }
      return result.status;
    });

    /** Apply remote deletes to local and get non-deletes component set (both tracking files).
     * Also updates remote tracking for deletes where no local file exists (STL skips these). */
    const maybeApplyRemoteDeletesToLocal = Effect.fn('SourceTrackingService.maybeApplyRemoteDeletesToLocal')(
      function* () {
        const tracking = yield* getOrCreateTracking();
        yield* rereadBoth(tracking);

        // Get all remote deletes as ChangeResult before applying — works even when local files don't exist
        const allRemoteDeletes = yield* Effect.tryPromise({
          try: () => tracking.getChanges({ origin: 'remote', state: 'delete', format: 'ChangeResult' }),
          catch: toSourceTrackingError
        });

        const result = yield* Effect.tryPromise({
          try: () => tracking.maybeApplyRemoteDeletesToLocal(true),
          catch: toSourceTrackingError
        }).pipe(Effect.withSpan('STL.MaybeApplyRemoteDeletesToLocal'));

        // STL only calls updateRemoteTracking for deletes it could resolve to local files.
        // For deletes with no local file, manually acknowledge them so they leave tracking.
        const handledTypeNames = HashSet.fromIterable(
          result.fileResponsesFromDelete.map(r => Data.struct({ type: r.type, fullName: r.fullName }))
        );

        const unhandled = allRemoteDeletes
          .filter(isResolvedChangeResult)
          .filter(c => !HashSet.has(handledTypeNames, Data.struct({ type: c.type, fullName: c.name })));

        if (unhandled.length > 0) {
          yield* Effect.tryPromise({
            try: () =>
              tracking.updateRemoteTracking(
                unhandled.map(c => ({ type: c.type, fullName: c.name, state: ComponentStatus.Deleted })),
                true // skipPolling — same as STL's deleteFilesAndUpdateTracking
              ),
            catch: toSourceTrackingError
          }).pipe(Effect.withSpan('STL.AcknowledgeUnhandledRemoteDeletes'));
        }

        // Surface unhandled deletes as synthetic FileResponse entries so the output channel
        // shows them even when there was no local file to delete.
        // filePath is empty string (falsy) so formatRetrieveOutput falls back to fullName for display.
        const syntheticDeletes: FileResponse[] = unhandled.map(c => ({
          type: c.type,
          fullName: c.name,
          state: ComponentStatus.Deleted,
          filePath: ''
        }));

        return {
          componentSetFromNonDeletes: result.componentSetFromNonDeletes,
          fileResponsesFromDelete: [...result.fileResponsesFromDelete, ...syntheticDeletes]
        };
      },
      remoteSemaphore.withPermits(1),
      localSemaphore.withPermits(1)
    );

    /** Get conflicts without UI side effects (both tracking files) */
    const getConflicts = Effect.fn('SourceTrackingService.getConflicts')((expectedOrgId?: string) =>
      getOrCreateTracking(expectedOrgId).pipe(
        Effect.tap(rereadBoth),
        Effect.flatMap(tracking =>
          Effect.tryPromise({
            try: () => tracking.getConflicts(),
            catch: toSourceTrackingError
          }).pipe(Effect.withSpan('STL.GetConflicts'))
        ),
        remoteSemaphore.withPermits(1),
        localSemaphore.withPermits(1)
      )
    );

    /** Check for conflicts and display them in the channel, failing if conflicts are found (both tracking files) */
    const checkConflicts = Effect.fn('SourceTrackingService.checkConflicts')(function* (expectedOrgId?: string) {
      const conflicts = yield* getConflicts(expectedOrgId);

      if (!conflicts?.length) {
        return yield* Effect.void;
      }
      yield* Effect.annotateCurrentSpan({
        conflicts: true
      });
      const channelService = yield* ChannelService;
      const truncated = conflicts.length > 30;
      const conflictDetails = conflicts
        .slice(0, 30)
        .map(c => `${c.type}:${c.name} (${(c.filenames ?? []).join(', ')})`);
      yield* channelService.appendToChannel(
        [
          'Conflicts detected',
          ...conflictDetails.map(detail => `  ${detail}`),
          ...(truncated ? [`  ... and ${conflicts.length - 30} more (only first 30 shown)`] : [])
        ].join('\n')
      );
      const channel = yield* channelService.getChannel;
      channel.show();
      return yield* new SourceTrackingConflictError({ conflicts: conflictDetails });
    });

    /** Maybe update tracking from retrieve result (both tracking files). No-op if tracking is not enabled. */
    const maybeUpdateTrackingFromRetrieve = Effect.fn('SourceTrackingService.maybeUpdateTrackingFromRetrieve')(
      (result: RetrieveResult, expectedOrgId?: string) =>
        Effect.annotateCurrentSpan({ files: result.getFileResponses().map(r => r.filePath) }).pipe(
          Effect.zipRight(
            hasTracking(expectedOrgId).pipe(
              Effect.flatMap(enabled =>
                enabled
                  ? getOrCreateTracking(expectedOrgId).pipe(
                      Effect.flatMap(tracking =>
                        Effect.tryPromise({
                          try: () => tracking.updateTrackingFromRetrieve(result),
                          catch: toSourceTrackingError
                        }).pipe(
                          Effect.withSpan('STL.UpdateTrackingFromRetrieve'),
                          Effect.tapError(error => Effect.logError(error))
                        )
                      )
                    )
                  : Effect.void
              ),
              Effect.asVoid,
              remoteSemaphore.withPermits(1),
              localSemaphore.withPermits(1)
            )
          )
        )
    );

    /** Maybe update tracking from deploy result (both tracking files). No-op if tracking is not enabled. */
    const maybeUpdateTrackingFromDeploy = Effect.fn('SourceTrackingService.maybeUpdateTrackingFromDeploy')(
      (result: DeployResult) =>
        hasTracking().pipe(
          Effect.flatMap(enabled =>
            enabled
              ? getOrCreateTracking().pipe(
                  Effect.flatMap(tracking =>
                    Effect.all(
                      [
                        Effect.tryPromise({
                          try: () => tracking.updateTrackingFromDeploy(result),
                          catch: toSourceTrackingError
                        }).pipe(
                          Effect.withSpan('STL.UpdateTrackingFromDeploy'),
                          Effect.tapError(error => Effect.logError(error))
                        ),
                        Effect.annotateCurrentSpan({ files: result.getFileResponses().map(r => r.filePath) })
                      ],
                      { concurrency: 'unbounded' }
                    )
                  )
                )
              : Effect.void
          ),
          Effect.asVoid,
          remoteSemaphore.withPermits(1),
          localSemaphore.withPermits(1)
        )
    );

    return {
      /** Check if source tracking is enabled for the current org without creating a tracking instance */
      hasTracking,

      /** Get local changes as ComponentSet (auto-rereads local tracking) */
      getLocalChangesAsComponentSet,

      /** Get remote non-deletes as ComponentSet (auto-rereads remote tracking) */
      getRemoteNonDeletesAsComponentSet,

      /** Get remote deletes as ComponentSet (auto-rereads remote tracking) */
      getRemoteDeletesAsComponentSet,

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
