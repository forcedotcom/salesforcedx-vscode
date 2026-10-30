/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Org, type Connection, type SfProject } from '@salesforce/core';
import {
  ComponentSet,
  ComponentStatus,
  type DeployResult,
  type FileResponse,
  type RetrieveResult
} from '@salesforce/source-deploy-retrieve';
import { SourceTracking, type ChangeResult } from '@salesforce/source-tracking';
import {
  ChannelService,
  ConfigService,
  ConnectionService,
  InactiveOrgOperationError,
  MetadataRegistryService,
  NoTargetOrgConfiguredError,
  ProjectService,
  SourceTrackingConflictError,
  SourceTrackingError,
  SourceTrackingNotEnabledError,
  SourceTrackingService,
  authFieldsFromConnection,
  orgIdFromConnection,
  type OrgId,
  type SourceTrackingOperationError,
  type SourceTrackingStatusOptions
} from '@salesforce/vscode-services-v2';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import * as Semaphore from 'effect/Semaphore';
import { ConnectionHost } from './connectionHost.js';
import { unknownToErrorCause } from './errorCause.js';
import { MetadataDescribeInvalidation } from './metadataDescribeService.js';
import { OrgMetadataCatalogRecorder } from './orgCatalog/orgMetadataCatalogRecorder.js';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';
import { trackingCacheOwnership } from './sourceTrackingCacheOwnership.js';
import { OrgChanges } from './targetOrgRef.js';

const toTrackingError = (error: unknown) => new SourceTrackingError(unknownToErrorCause(error));
type TrackingIdentity = { readonly orgId: OrgId; readonly orgGeneration: number; readonly connection: Connection };
type TrackingEntry = TrackingIdentity & {
  readonly project: SfProject;
  readonly tracking: SourceTracking;
  readonly runNative: ReturnType<typeof trackingCacheOwnership>['run'];
  readonly releaseCaches: () => void;
  readonly leases: Ref.Ref<readonly Deferred.Deferred<void>[]>;
};
const isResolvedChange = Schema.is(Schema.Struct({ name: Schema.String, type: Schema.String }));
const resolvedChanges = (changes: readonly ChangeResult[]) =>
  changes.filter((change): change is ChangeResult & { name: string; type: string } => isResolvedChange(change));

export const SourceTrackingServiceLayer = Layer.effect(
  SourceTrackingService,
  Effect.gen(function* () {
    const connections = yield* ConnectionService;
    const projects = yield* ProjectService;
    const config = yield* ConfigService;
    const registry = yield* MetadataRegistryService;
    const descriptions = yield* MetadataDescribeInvalidation;
    const recorder = yield* OrgMetadataCatalogRecorder;
    const channel = yield* ChannelService;
    const changes = yield* OrgChanges;
    const host = yield* ConnectionHost;
    const operations = yield* ServiceOperations;
    const creation = yield* Semaphore.make(1);
    const local = yield* Semaphore.make(1);
    const remote = yield* Semaphore.make(1);
    const current = yield* Ref.make(Option.none<TrackingEntry>());
    const changedError = (orgId: OrgId) =>
      new InactiveOrgOperationError({ expectedOrgId: orgId, message: host.messages.orgChanged(orgId) });
    const validate = (identity: TrackingIdentity) =>
      changes.commitIfCurrent(identity.orgGeneration, changedError(identity.orgId), Effect.void);
    // SDK promises cannot abort. Keep the lease and domain permits until the public promise settles.
    // This does not claim completion of STL's hidden fail-fast siblings or abandoned poll attempts.
    const native = <A>(name: string, run: () => Promise<A>) =>
      Effect.tryPromise({ try: run, catch: toTrackingError }).pipe(Effect.uninterruptible, Effect.withSpan(name));
    const sdk = <A>(entry: TrackingEntry, name: string, caches: 'local' | 'remote' | 'both', run: () => Promise<A>) =>
      validate(entry).pipe(
        Effect.andThen(native(name, () => entry.runNative(run, caches))),
        Effect.tap(() => validate(entry))
      );
    const capture = Effect.fn('SourceTrackingService.capture')(function* (expectedOrgId?: OrgId) {
      const connection = yield* expectedOrgId
        ? connections.getConnectionForOrg(expectedOrgId)
        : connections.getConnection();
      const orgId = expectedOrgId ?? Option.getOrUndefined(orgIdFromConnection(connection));
      if (!orgId)
        return yield* new NoTargetOrgConfiguredError({
          message: 'No active org identity is available for source tracking'
        });
      const snapshot = yield* changes.snapshot;
      const username =
        connection.getUsername() ??
        Option.getOrUndefined(Option.flatMap(authFieldsFromConnection(connection), fields => fields.username));
      if (snapshot.org.orgId !== orgId || snapshot.org.username?.toLowerCase() !== username?.toLowerCase())
        return yield* changedError(orgId);
      const identity = { connection, orgId, orgGeneration: snapshot.orgGeneration };
      // Undefined is not false: enrichment may still be running. Resolve against this exact native connection.
      const aggregator = yield* config.getConfigAggregator();
      const org = yield* native('Org.create', () => Org.create({ connection, aggregator }));
      const enabled = snapshot.org.tracksSource ?? (yield* native('Org.tracksSource', () => org.tracksSource()));
      yield* validate(identity);
      return { ...identity, org, enabled };
    });
    const retire = (entry: TrackingEntry) =>
      Ref.get(entry.leases).pipe(
        Effect.flatMap(leases => Effect.forEach(leases, lease => Deferred.await(lease), { discard: true })),
        Effect.andThen(Effect.sync(entry.releaseCaches))
      );
    const acquire = Effect.fn('SourceTrackingService.acquire')(
      function* (identity: Effect.Success<ReturnType<typeof capture>>) {
        const project = yield* projects.getSfProject();
        yield* validate(identity);
        const completed = yield* Deferred.make<void>();
        const previous = yield* Ref.get(current);
        const cached =
          Option.isSome(previous) &&
          previous.value.orgGeneration === identity.orgGeneration &&
          previous.value.connection === identity.connection &&
          previous.value.project === project
            ? previous.value
            : undefined;
        if (cached) {
          yield* Ref.update(cached.leases, leases => [...leases, completed]);
          return { entry: cached, completed };
        }
        if (Option.isSome(previous)) {
          yield* Ref.set(current, Option.none());
          // Release requires neither creation nor domain/org permits, so old calls can always drain.
          yield* retire(previous.value);
        }
        yield* validate(identity);
        const access = yield* registry.getRegistryAccess();
        const tracking = yield* native('STL create', () =>
          SourceTracking.create({
            org: identity.org,
            project,
            registry: access,
            subscribeSDREvents: false,
            ignoreConflicts: false
          })
        );
        const caches = trackingCacheOwnership(tracking, identity.orgId);
        const entry: TrackingEntry = {
          ...identity,
          project,
          tracking,
          releaseCaches: caches.release,
          runNative: caches.run,
          leases: yield* Ref.make<readonly Deferred.Deferred<void>[]>([completed])
        };
        yield* Ref.set(current, Option.some(entry));
        return { entry, completed };
      },
      program => creation.withPermit(program)
    );
    const release = ({ entry, completed }: Effect.Success<ReturnType<typeof acquire>>) =>
      Ref.update(entry.leases, leases => leases.filter(lease => lease !== completed)).pipe(
        Effect.andThen(Deferred.succeed(completed, undefined))
      );
    const withCapturedTracking = <A, E>(
      identity: Effect.Success<ReturnType<typeof capture>>,
      options: { local?: boolean; remote?: boolean },
      use: (entry: TrackingEntry) => Effect.Effect<A, E>
    ): Effect.Effect<A, E | SourceTrackingOperationError> =>
      identity.enabled
        ? Effect.acquireUseRelease(
            acquire(identity),
            ({ entry }) => {
              // Consistent nested local→remote acquisition; the lease is acquired BEFORE either domain permit.
              const program = validate(entry).pipe(
                Effect.andThen(use(entry)),
                Effect.tap(() => validate(entry))
              );
              return options.local
                ? local.withPermit(options.remote ? remote.withPermit(program) : program)
                : remote.withPermit(program);
            },
            release
          )
        : Effect.fail(new SourceTrackingNotEnabledError({ message: 'Source tracking is not enabled' }));
    const withTracking = <A, E>(
      options: { local?: boolean; remote?: boolean },
      use: (entry: TrackingEntry) => Effect.Effect<A, E>,
      expectedOrgId?: OrgId
    ) => capture(expectedOrgId).pipe(Effect.flatMap(identity => withCapturedTracking(identity, options, use)));
    const rereadLocal = (entry: TrackingEntry) =>
      sdk(entry, 'STL.ReReadLocalTrackingCache', 'local', () => entry.tracking.reReadLocalTrackingCache());
    const rereadRemote = (entry: TrackingEntry) =>
      sdk(entry, 'STL.ReReadRemoteTracking', 'remote', () => entry.tracking.reReadRemoteTracking());
    const rereadBoth = (entry: TrackingEntry) => rereadLocal(entry).pipe(Effect.andThen(rereadRemote(entry)));
    const hasTracking = Effect.fn('SourceTrackingService.hasTracking')(
      (expectedOrgId?: OrgId) => capture(expectedOrgId).pipe(Effect.map(identity => identity.enabled)),
      operations.run
    );
    const getLocalChangesAsComponentSet = Effect.fn('SourceTrackingService.getLocalChangesAsComponentSet')(
      () =>
        withTracking({ local: true }, entry =>
          rereadLocal(entry).pipe(
            Effect.andThen(
              sdk(entry, 'STL.LocalChangesAsComponentSet', 'local', () =>
                entry.tracking.localChangesAsComponentSet(false)
              )
            )
          )
        ),
      operations.run
    );
    const getRemoteNonDeletesAsComponentSet = Effect.fn('SourceTrackingService.getRemoteNonDeletesAsComponentSet')(
      (options: { applyIgnore: boolean }) =>
        withTracking({ remote: true }, entry =>
          rereadRemote(entry).pipe(
            Effect.andThen(
              sdk(entry, 'STL.RemoteNonDeletesAsComponentSet', 'remote', () =>
                entry.tracking.remoteNonDeletesAsComponentSet(options)
              )
            )
          )
        ),
      operations.run
    );
    const getRemoteDeletesAsComponentSet = Effect.fn('SourceTrackingService.getRemoteDeletesAsComponentSet')(
      () =>
        withTracking({ remote: true }, entry =>
          rereadRemote(entry).pipe(
            Effect.andThen(
              sdk(entry, 'STL.RemoteDeletesAsComponentSet', 'remote', () =>
                entry.tracking.getChanges({ origin: 'remote', state: 'delete', format: 'ChangeResult' })
              )
            ),
            Effect.map(
              rows =>
                new ComponentSet(
                  resolvedChanges(rows).map(row => ({ type: row.type, fullName: row.name })),
                  entry.tracking.registry
                )
            )
          )
        ),
      operations.run
    );
    const resetRemoteTracking = Effect.fn('SourceTrackingService.resetRemoteTracking')(
      () =>
        withTracking({ remote: true }, entry =>
          sdk(entry, 'STL.ResetRemoteTracking', 'remote', () => entry.tracking.resetRemoteTracking())
        ),
      operations.run
    );
    const getStatus = Effect.fn('SourceTrackingService.getStatus')(
      (options: SourceTrackingStatusOptions, expectedOrgId?: OrgId) =>
        withTracking(
          options,
          entry =>
            Effect.gen(function* () {
              if (options.local) yield* rereadLocal(entry);
              if (options.remote) yield* rereadRemote(entry);
              const status = yield* sdk(
                entry,
                'STL.GetStatus',
                options.local ? (options.remote ? 'both' : 'local') : 'remote',
                () => entry.tracking.getStatus({ local: options.local === true, remote: options.remote === true })
              );
              if (options.remote) {
                const nonDeletes = yield* sdk(entry, 'STL.RemoteNonDeletes', 'remote', () =>
                  entry.tracking.getChanges({ origin: 'remote', state: 'nondelete', format: 'ChangeResult' })
                );
                const deletes = yield* sdk(entry, 'STL.RemoteDeletes', 'remote', () =>
                  entry.tracking.getChanges({ origin: 'remote', state: 'delete', format: 'ChangeResult' })
                );
                const prepared = yield* recorder.prepareTrackingStatus(
                  entry.orgId,
                  status,
                  resolvedChanges([...nonDeletes, ...deletes])
                );
                // Invalidate before consuming the signature/publishing. A failed invalidation remains retryable.
                yield* descriptions.invalidateForTracking(entry.orgId, entry.orgGeneration, prepared.references);
                yield* recorder.commitTrackingStatus(entry.orgId, entry.orgGeneration, prepared);
              }
              yield* Effect.annotateCurrentSpan({ statusRows: status.length });
              return status;
            }),
          expectedOrgId
        ),
      operations.run
    );
    const maybeApplyRemoteDeletesToLocal = Effect.fn('SourceTrackingService.maybeApplyRemoteDeletesToLocal')(
      () =>
        withTracking({ local: true, remote: true }, entry =>
          Effect.gen(function* () {
            yield* rereadBoth(entry);
            const deletes = yield* sdk(entry, 'STL.RemoteDeletes', 'remote', () =>
              entry.tracking.getChanges({ origin: 'remote', state: 'delete', format: 'ChangeResult' })
            );
            const result = yield* sdk(entry, 'STL.MaybeApplyRemoteDeletesToLocal', 'both', () =>
              entry.tracking.maybeApplyRemoteDeletesToLocal(true)
            );
            const handled = HashSet.fromIterable(
              result.fileResponsesFromDelete.map(row => ({ type: row.type, fullName: row.fullName }))
            );
            const unhandled = resolvedChanges(deletes).filter(
              row => !HashSet.has(handled, { type: row.type, fullName: row.name })
            );
            if (unhandled.length > 0)
              yield* sdk(entry, 'STL.AcknowledgeUnhandledRemoteDeletes', 'remote', () =>
                entry.tracking.updateRemoteTracking(
                  unhandled.map(row => ({ type: row.type, fullName: row.name, state: ComponentStatus.Deleted })),
                  true
                )
              );
            // Empty filePath preserves the existing output formatter's fullName fallback for missing local files.
            const synthetic: FileResponse[] = unhandled.map(row => ({
              type: row.type,
              fullName: row.name,
              state: ComponentStatus.Deleted,
              filePath: ''
            }));
            return {
              componentSetFromNonDeletes: result.componentSetFromNonDeletes,
              fileResponsesFromDelete: [...result.fileResponsesFromDelete, ...synthetic]
            };
          })
        ),
      operations.run
    );
    const readConflicts = (entry: TrackingEntry) =>
      rereadBoth(entry).pipe(
        Effect.andThen(sdk(entry, 'STL.GetConflicts', 'both', () => entry.tracking.getConflicts()))
      );
    const getConflicts = Effect.fn('SourceTrackingService.getConflicts')(
      (expectedOrgId?: OrgId) => withTracking({ local: true, remote: true }, readConflicts, expectedOrgId),
      operations.run
    );
    const checkConflicts = Effect.fn('SourceTrackingService.checkConflicts')(
      (expectedOrgId?: OrgId) =>
        withTracking(
          { local: true, remote: true },
          entry =>
            readConflicts(entry).pipe(
              Effect.flatMap(conflicts => {
                if (conflicts.length === 0) return Effect.void;
                const details = conflicts
                  .slice(0, 30)
                  .map(row => `${row.type}:${row.name} (${(row.filenames ?? []).join(', ')})`);
                return changes.commitIfCurrent(
                  entry.orgGeneration,
                  changedError(entry.orgId),
                  channel
                    .appendToChannel(
                      [
                        'Conflicts detected',
                        ...details.map(detail => `  ${detail}`),
                        ...(conflicts.length > 30
                          ? [`  ... and ${conflicts.length - 30} more (only first 30 shown)`]
                          : [])
                      ].join('\n')
                    )
                    .pipe(
                      Effect.andThen(channel.getChannel),
                      Effect.tap(output => Effect.sync(() => output.show())),
                      Effect.andThen(Effect.fail(new SourceTrackingConflictError({ conflicts: details })))
                    )
                );
              })
            ),
          expectedOrgId
        ),
      operations.run
    );
    const maybeUpdateTrackingFromRetrieve = Effect.fn('SourceTrackingService.maybeUpdateTrackingFromRetrieve')(
      function* (result: RetrieveResult, expectedOrgId?: OrgId) {
        const identity = yield* capture(expectedOrgId);
        if (!identity.enabled) return;
        yield* Effect.annotateCurrentSpan({ fileResponseCount: result.getFileResponses().length });
        yield* withCapturedTracking(identity, { local: true, remote: true }, entry =>
          sdk(entry, 'STL.UpdateTrackingFromRetrieve', 'both', () =>
            entry.tracking.updateTrackingFromRetrieve(result)
          ).pipe(Effect.tapError(Effect.logError))
        );
      },
      operations.run
    );
    const maybeUpdateTrackingFromDeploy = Effect.fn('SourceTrackingService.maybeUpdateTrackingFromDeploy')(function* (
      result: DeployResult
    ) {
      const identity = yield* capture();
      if (!identity.enabled) return;
      yield* Effect.annotateCurrentSpan({ fileResponseCount: result.getFileResponses().length });
      yield* withCapturedTracking(identity, { local: true, remote: true }, entry =>
        sdk(entry, 'STL.UpdateTrackingFromDeploy', 'both', () => entry.tracking.updateTrackingFromDeploy(result)).pipe(
          Effect.tapError(Effect.logError)
        )
      );
    }, operations.run);
    yield* Effect.addFinalizer(() =>
      operations.close.pipe(
        Effect.ensuring(
          Ref.get(current).pipe(Effect.flatMap(Option.match({ onNone: () => Effect.void, onSome: retire })))
        )
      )
    );
    return SourceTrackingService.of({
      hasTracking,
      getLocalChangesAsComponentSet,
      getRemoteNonDeletesAsComponentSet,
      getRemoteDeletesAsComponentSet,
      resetRemoteTracking,
      getStatus,
      maybeApplyRemoteDeletesToLocal,
      getConflicts,
      checkConflicts,
      maybeUpdateTrackingFromRetrieve,
      maybeUpdateTrackingFromDeploy
    });
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
