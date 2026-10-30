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
  FailedToBuildComponentSetError,
  MetadataRegistryService,
  MetadataRetrieveError,
  MetadataRetrieveService,
  ProjectService,
  SourceTrackingService,
  UserCancellationError,
  isSDRSuccess,
  WorkspaceService,
  type MetadataRetrieveOptions,
  type NonEmptyComponentSet,
  type OrgId
} from '@salesforce/vscode-services-v2';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { unknownToErrorCause } from './errorCause.js';
import { MetadataOperationNotifications } from './metadataOperationNotifications.js';
import { MetadataOperationOrg } from './metadataOperationOrg.js';
import { performNativeMetadataOperation } from './nativeMetadataOperation.js';
import { OrgMetadataCatalogRecorder } from './orgCatalog/orgMetadataCatalogRecorder.js';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';
import { SourceTrackingResultUpdates } from './sourceTrackingService.js';
import { uriToPath } from './uriUtils.js';

const retrieveFailure = (cause: unknown) =>
  new MetadataRetrieveError({ cause, message: unknownToErrorCause(cause).message });
const buildFailure = (cause: unknown) => new FailedToBuildComponentSetError(unknownToErrorCause(cause));

const performRetrieve = Effect.fn('MetadataRetrieveService.performRetrieve')(
  (
    options: ConstructorParameters<typeof MetadataApiRetrieve>[0],
    title: string,
    location: vscode.ProgressLocation = vscode.ProgressLocation.Notification
  ) =>
    performNativeMetadataOperation(
      async () => {
        const operation = new MetadataApiRetrieve(options);
        // SDK start resets its cancellation flag; the shared boundary replays a request only after this settles.
        await operation.start();
        return operation;
      },
      { title, location, cancellable: true },
      retrieveFailure,
      ({
        result,
        cancellation,
        cancelRequested
      }): Effect.Effect<
        Awaited<ReturnType<MetadataApiRetrieve['pollStatus']>>,
        MetadataRetrieveError | UserCancellationError
      > => {
        if (Exit.isFailure(cancellation))
          return Effect.failCause(
            Exit.isFailure(result) ? Cause.combine(result.cause, cancellation.cause) : cancellation.cause
          );
        return Exit.isSuccess(result) && cancelRequested
          ? Effect.fail(new UserCancellationError({ message: 'User cancelled retrieve' }))
          : result;
      }
    )
);

export const MetadataRetrieveServiceLayer = Layer.effect(
  MetadataRetrieveService,
  Effect.gen(function* () {
    const orgs = yield* MetadataOperationOrg;
    const projects = yield* ProjectService;
    const workspace = yield* WorkspaceService;
    const tracking = yield* SourceTrackingService;
    const trackingResults = yield* SourceTrackingResultUpdates;
    const notifications = yield* MetadataOperationNotifications;
    const componentsService = yield* ComponentSetService;
    const registry = yield* MetadataRegistryService;
    const recorder = yield* OrgMetadataCatalogRecorder;
    const operations = yield* ServiceOperations;
    const active = yield* ActiveMetadataOperationRef;
    const withActiveOperation = <A, E>(program: Effect.Effect<A, E>) =>
      Effect.acquireUseRelease(
        SubscriptionRef.update(active, count => count + 1),
        () => program,
        () => SubscriptionRef.update(active, count => count - 1)
      );
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
        const org = yield* orgs.capture(options?.expectedOrgId);
        const access = yield* registry.getRegistryAccess();
        yield* componentsService.setComponentSetProperties(components, outputPath);
        yield* orgs.validate(org);
        const result = yield* performRetrieve(
          {
            usernameOrConnection: org.connection,
            components,
            output: uriToPath(outputPath),
            format: 'source',
            merge: false,
            registry: access
          },
          `Retrieving ${components.size} component${components.size === 1 ? '' : 's'} for diff`,
          options?.progressLocation
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
        yield* recorder.recordRemoteComponents(org.orgId, org.orgGeneration, 'metadata-api', [
          ...observations.values()
        ]);
        yield* orgs.validate(org);
        return result;
      },
      withActiveOperation,
      operations.run
    );
    const performMergedRetrieve = Effect.fn('MetadataRetrieveService.performMergedRetrieve')(function* (
      components: ComponentSet,
      title: string,
      setComponentSetProperties: boolean,
      options?: MetadataRetrieveOptions
    ) {
      yield* workspace.getWorkspaceInfoOrThrow();
      const org = yield* orgs.capture(options?.expectedOrgId);
      const project = yield* projects.getSfProject();
      const access = yield* registry.getRegistryAccess();
      if (setComponentSetProperties) yield* componentsService.setComponentSetProperties(components);
      if ((yield* tracking.hasTracking(org.orgId)) && !options?.ignoreConflicts)
        yield* tracking.checkConflicts(org.orgId);
      yield* orgs.validate(org);
      const result = yield* performRetrieve(
        {
          usernameOrConnection: org.connection,
          components,
          output: project.getDefaultPackage().fullPath,
          format: 'source',
          merge: true,
          registry: access
        },
        title,
        options?.progressLocation
      );
      yield* orgs.validate(org);
      yield* trackingResults.maybeUpdateTrackingFromRetrieve(result, org);
      yield* notifications.publish(result, org, 'retrieve');
      yield* orgs.validate(org);
      return result;
    });
    const retrieve = Effect.fn('MetadataRetrieveService.retrieve')(
      (members: MetadataMember[], options?: MetadataRetrieveOptions) =>
        buildComponentSet(members).pipe(
          Effect.flatMap(components =>
            performMergedRetrieve(
              components,
              `Retrieving ${members.map(member => `${member.type}: ${member.fullName === '*' ? 'all' : member.fullName}`).join(', ')}`,
              false,
              options
            )
          )
        ),
      withActiveOperation,
      operations.run
    );
    const retrieveComponentSet = Effect.fn('MetadataRetrieveService.retrieveComponentSet')(
      (components: ComponentSet, options?: MetadataRetrieveOptions) =>
        performMergedRetrieve(
          components,
          `Retrieving ${components.size} component${components.size === 1 ? '' : 's'}`,
          true,
          options
        ),
      withActiveOperation,
      operations.run
    );
    yield* Effect.addFinalizer(() => operations.close);
    return MetadataRetrieveService.of({
      retrieve,
      retrieveComponentSet,
      buildComponentSet,
      buildComponentSetFromSource,
      retrieveComponentSetToDirectory
    });
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
