/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ComponentSet, MetadataApiRetrieve, type MetadataMember } from '@salesforce/source-deploy-retrieve';
import {
  ActiveMetadataOperationRef,
  ComponentSetService,
  ConnectionService,
  FailedToBuildComponentSetError,
  InactiveOrgOperationError,
  MetadataRegistryService,
  MetadataRetrieveError,
  MetadataRetrieveService,
  NoTargetOrgConfiguredError,
  UserCancellationError,
  authFieldsFromConnection,
  isSDRSuccess,
  orgIdFromConnection,
  type NonEmptyComponentSet,
  type OrgId
} from '@salesforce/vscode-services-v2';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { ConnectionHost } from './connectionHost.js';
import { unknownToErrorCause } from './errorCause.js';
import { OrgMetadataCatalogRecorder } from './orgCatalog/orgMetadataCatalogRecorder.js';
import { finalizerFailureCause } from './scopedFiber.js';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';
import { OrgChanges } from './targetOrgRef.js';
import { uriToPath } from './uriUtils.js';

const retrieveFailure = (cause: unknown) =>
  new MetadataRetrieveError({ cause, message: unknownToErrorCause(cause).message });
const buildFailure = (cause: unknown) => new FailedToBuildComponentSetError(unknownToErrorCause(cause));

/** This ordinary Promise boundary owns SDK start, polling/extraction, cancellation, and the host token listener together. */
const startNativeRetrieve = (operation: MetadataApiRetrieve, options: vscode.ProgressOptions) => {
  let startCompleted = false;
  let cancelRequested = false;
  let settled = false;
  let cancelPromise: Promise<Exit.Exit<void, MetadataRetrieveError>> | undefined;
  const requestCancel = () => {
    cancelRequested = true;
    // SDK start() resets its cancellation flag. Cancellation requested before start must be replayed after it settles.
    if (startCompleted && !settled && !cancelPromise)
      cancelPromise = Promise.resolve()
        .then(() => operation.cancel())
        .then(
          () => Exit.succeed(undefined),
          cause => Exit.fail(retrieveFailure(cause))
        );
  };
  const completed = Promise.resolve(
    vscode.window.withProgress(options, async (_progress, token) => {
      const listener = token.onCancellationRequested(requestCancel);
      try {
        if (token.isCancellationRequested) requestCancel();
        await operation.start();
        startCompleted = true;
        if (cancelRequested) requestCancel();
        return await operation.pollStatus();
      } finally {
        listener.dispose();
      }
    })
  )
    .then(
      value => Exit.succeed(value),
      cause => Exit.fail(retrieveFailure(cause))
    )
    .then(
      async (
        exit
      ): Promise<
        Exit.Exit<Awaited<ReturnType<MetadataApiRetrieve['pollStatus']>>, MetadataRetrieveError | UserCancellationError>
      > => {
        const cancellation = cancelPromise ? await cancelPromise : Exit.succeed(undefined);
        settled = true;
        if (Exit.isFailure(cancellation))
          return Exit.failCause(
            Exit.isFailure(exit) ? Cause.combine(exit.cause, cancellation.cause) : cancellation.cause
          );
        return Exit.isSuccess(exit) && cancelRequested
          ? Exit.fail(new UserCancellationError({ message: 'User cancelled retrieve' }))
          : exit;
      }
    );
  return { completed, requestCancel, isSettled: () => settled };
};

const performRetrieve = Effect.fn('MetadataRetrieveService.performRetrieve')(
  (
    options: ConstructorParameters<typeof MetadataApiRetrieve>[0],
    title: string,
    location: vscode.ProgressLocation = vscode.ProgressLocation.Notification
  ) =>
    Effect.acquireUseRelease(
      Effect.try({
        try: () => startNativeRetrieve(new MetadataApiRetrieve(options), { title, location, cancellable: true }),
        catch: retrieveFailure
      }),
      native => Effect.promise(() => native.completed).pipe(Effect.flatMap(exit => exit)),
      (native, useExit) => {
        const interrupted =
          Exit.isFailure(useExit) && useExit.cause.reasons.some(reason => reason._tag === 'Interrupt');
        // Native settlement does not mean Effect consumed the Exit. Interrupted consumption must still report its failures.
        if (native.isSettled() && !interrupted) return Effect.void;
        return Effect.sync(() => {
          if (!native.isSettled()) native.requestCancel();
        }).pipe(
          Effect.andThen(Effect.promise(() => native.completed)),
          Effect.flatMap(exit => {
            if (Exit.isSuccess(exit)) return Effect.void;
            const propagated = Exit.isFailure(useExit) ? useExit.cause.reasons : [];
            const cause = finalizerFailureCause(
              Cause.fromReasons(
                exit.cause.reasons.filter(reason =>
                  reason._tag === 'Fail'
                    ? reason.error._tag !== 'UserCancellationError' &&
                      !propagated.some(previous => previous._tag === 'Fail' && previous.error === reason.error)
                    : reason._tag === 'Die' &&
                      !propagated.some(previous => previous._tag === 'Die' && previous.defect === reason.defect)
                )
              )
            );
            return cause.reasons.length > 0 ? Effect.failCause(cause) : Effect.void;
          })
        );
      }
    )
);

export const MetadataRetrieveServiceLayer = Layer.effect(
  MetadataRetrieveService,
  Effect.gen(function* () {
    const connections = yield* ConnectionService;
    const componentsService = yield* ComponentSetService;
    const registry = yield* MetadataRegistryService;
    const recorder = yield* OrgMetadataCatalogRecorder;
    const changes = yield* OrgChanges;
    const host = yield* ConnectionHost;
    const operations = yield* ServiceOperations;
    const active = yield* ActiveMetadataOperationRef;
    const buildComponentSet = Effect.fn('MetadataRetrieveService.buildComponentSet')(function* (
      members: MetadataMember[]
    ) {
      const access = yield* registry.getRegistryAccess();
      return yield* Effect.try({ try: () => new ComponentSet(members, access), catch: buildFailure });
    }, operations.run);
    const buildComponentSetFromSource = Effect.fn('MetadataRetrieveService.buildComponentSetFromSource')(function* (
      sourcePaths: string[],
      filterMembers: MetadataMember[]
    ) {
      const access = yield* registry.getRegistryAccess();
      const include = filterMembers.length > 0 ? yield* buildComponentSet(filterMembers) : undefined;
      return yield* Effect.try({
        try: () => ComponentSet.fromSource({ fsPaths: sourcePaths, include, registry: access }),
        catch: buildFailure
      });
    }, operations.run);
    const retrieveComponentSetToDirectory = Effect.fn('MetadataRetrieveService.retrieveComponentSetToDirectory')(
      function* (
        components: NonEmptyComponentSet,
        outputPath: URI,
        options?: { readonly progressLocation?: vscode.ProgressLocation; readonly expectedOrgId?: OrgId }
      ) {
        const connection = yield* options?.expectedOrgId
          ? connections.getConnectionForOrg(options.expectedOrgId)
          : connections.getConnection();
        const orgId = options?.expectedOrgId ?? Option.getOrUndefined(orgIdFromConnection(connection));
        if (!orgId)
          return yield* new NoTargetOrgConfiguredError({
            message: 'No active org identity is available for metadata retrieve'
          });
        const snapshot = yield* changes.snapshot;
        const username =
          connection.getUsername() ??
          Option.getOrUndefined(Option.flatMap(authFieldsFromConnection(connection), fields => fields.username));
        const changedError = new InactiveOrgOperationError({
          expectedOrgId: orgId,
          message: host.messages.orgChanged(orgId)
        });
        if (snapshot.org.orgId !== orgId || snapshot.org.username?.toLowerCase() !== username?.toLowerCase())
          return yield* changedError;
        const access = yield* registry.getRegistryAccess();
        yield* componentsService.setComponentSetProperties(components, outputPath);
        yield* changes.commitIfCurrent(snapshot.orgGeneration, changedError, Effect.void);
        const result = yield* Effect.acquireUseRelease(
          SubscriptionRef.update(active, value => value + 1),
          () =>
            performRetrieve(
              {
                usernameOrConnection: connection,
                components,
                output: uriToPath(outputPath),
                format: 'source',
                merge: false,
                registry: access
              },
              `Retrieving ${components.size} component${components.size === 1 ? '' : 's'} for diff`,
              options?.progressLocation
            ),
          () => SubscriptionRef.update(active, value => value - 1)
        );
        const properties = Array.isArray(result.response.fileProperties)
          ? result.response.fileProperties
          : [result.response.fileProperties];
        const observations = new Map(
          properties.flatMap(property =>
            property?.type && property.fullName
              ? [
                  [
                    `${property.type}\0${property.fullName}`,
                    {
                      type: property.type,
                      fullName: property.fullName,
                      ...(property.lastModifiedDate ? { lastModifiedDate: property.lastModifiedDate } : {})
                    }
                  ] as const
                ]
              : []
          )
        );
        result
          .getFileResponses()
          .filter(isSDRSuccess)
          .forEach(response => {
            const key = `${response.type}\0${response.fullName}` as const;
            if (!observations.has(key)) observations.set(key, { type: response.type, fullName: response.fullName });
          });
        yield* recorder.recordRemoteComponents(orgId, snapshot.orgGeneration, 'metadata-api', [
          ...observations.values()
        ]);
        yield* changes.commitIfCurrent(snapshot.orgGeneration, changedError, Effect.void);
        return result;
      },
      operations.run
    );
    yield* Effect.addFinalizer(() => operations.close);
    return MetadataRetrieveService.of({
      buildComponentSet,
      buildComponentSetFromSource,
      retrieveComponentSetToDirectory
    });
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
