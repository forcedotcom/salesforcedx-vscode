/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import type { SfProject } from '@salesforce/core/project';
import {
  type MetadataMember,
  MetadataApiRetrieve,
  ComponentSet,
  type RegistryAccess
} from '@salesforce/source-deploy-retrieve';

import * as Cause from 'effect/Cause';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Option from 'effect/Option';
import * as Runtime from 'effect/Runtime';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { OrgMetadataCatalogRecorder } from '../orgCatalog/orgMetadataCatalogRecorder';
import { FsService } from '../vscode/fsService';
import { uriToPath } from '../vscode/paths';
import { UserCancellationError } from '../vscode/prompts/promptService';
import { WorkspaceService } from '../vscode/workspaceService';
import { withActiveMetadataOperationPipeline } from './activeMetadataOperationRef';
import { FailedToBuildComponentSetError, NonEmptyComponentSet, setComponentSetProperties } from './componentSetService';
import { ConfigService } from './configService';
import { ConnectionService } from './connectionService';
import { dedupeMetadataChanges, MetadataChangeNotificationService } from './metadataChangeNotificationService';
import { MetadataDescribeService } from './metadataDescribeService';
import { MetadataRegistryService } from './metadataRegistryService';
import { ProjectService } from './projectService';
import { isSDRSuccess, toComponentStatusChangeType } from './sdrGuards';
import { unknownToErrorCause } from './shared';
import { SourceTrackingService, type SourceTrackingOptions } from './sourceTrackingService';

export class MetadataRetrieveError extends Data.TaggedError('MetadataRetrieveError')<{
  readonly cause: unknown;
}> {}

type PerformRetrieveOperationInput = {
  componentSet: ComponentSet;
  connection: Connection;
  registryAccess: RegistryAccess;
  title: string;
  expectedOrgId?: string;
} & (
  | {
      merge: true;
      project: SfProject;
    }
  | {
      merge: false;
      outputPath: URI;
    }
);

type MetadataRetrieveOptions = SourceTrackingOptions & { readonly expectedOrgId?: string };

export class MetadataRetrieveService extends Effect.Service<MetadataRetrieveService>()('MetadataRetrieveService', {
  accessors: true,
  dependencies: [
    WorkspaceService.Default,
    ConnectionService.Default,
    SourceTrackingService.Default,
    MetadataRegistryService.Default,
    ProjectService.Default,
    ConfigService.Default,
    MetadataChangeNotificationService.Default,
    MetadataDescribeService.Default,
    OrgMetadataCatalogRecorder.Default,
    FsService.Default
  ],
  effect: Effect.gen(function* () {
    const workspaceService = yield* WorkspaceService;
    const connectionService = yield* ConnectionService;
    const sourceTrackingService = yield* SourceTrackingService;
    const projectService = yield* ProjectService;
    const configService = yield* ConfigService;
    const metadataRegistryService = yield* MetadataRegistryService;
    const notificationService = yield* MetadataChangeNotificationService;
    const metadataDescribeService = yield* MetadataDescribeService;
    const catalogRecorder = yield* OrgMetadataCatalogRecorder;
    const fsService = yield* FsService;

    const publishRetrieveNotifications = Effect.fn('MetadataRetrieveService.publishRetrieveNotifications')(function* (
      retrieveOutcome: Awaited<ReturnType<MetadataApiRetrieve['pollStatus']>>,
      expectedOrgId?: string
    ) {
      const successfulResponses = retrieveOutcome.getFileResponses().filter(isSDRSuccess);
      const changes = dedupeMetadataChanges(
        yield* Effect.forEach(
          successfulResponses,
          response =>
            Effect.gen(function* () {
              return {
                metadataType: response.type,
                fullName: response.fullName,
                changeType: toComponentStatusChangeType(response.state),
                fileUri: Option.fromNullable(response.filePath ? yield* fsService.toUri(response.filePath) : undefined)
              };
            }),
          { concurrency: 'unbounded' }
        )
      );
      if (changes.length === 0) return;
      const orgId = expectedOrgId;
      yield* Effect.annotateCurrentSpan({
        rawFileResponseCount: successfulResponses.length,
        uniqueComponentCount: changes.length,
        affectedMetadataTypeCount: new Set(changes.map(change => change.metadataType)).size
      });
      const event = {
        ...(orgId ? { orgId } : {}),
        operation: 'retrieve',
        completedAt: new Date().toISOString(),
        changes: [...changes]
      } as const;
      yield* notificationService.publishOperation(event);
      if (orgId) {
        yield* metadataDescribeService.invalidateForMetadataChanges(
          orgId,
          changes.map(change => ({ xmlName: change.metadataType, fullName: change.fullName }))
        );
      }
      yield* catalogRecorder.recordOperation(event);
    });

    const buildComponentSet = Effect.fn('MetadataRetrieveService.buildComponentSet')(function* (
      members: MetadataMember[]
    ) {
      const registryAccess = yield* metadataRegistryService.getRegistryAccess();
      return yield* Effect.try({
        try: () => new ComponentSet(members, registryAccess),
        catch: e => {
          const { cause } = unknownToErrorCause(e);
          return new FailedToBuildComponentSetError({
            message: `Failed to build ComponentSet: ${cause.message}`,
            cause
          });
        }
      });
    });

    /** Build a ComponentSet from source paths.
     *
     * If you pass a members array, that will be used to filter the components (componentSet will only include the members you pass in)
     *
     * pass an empty array to include all components from the source paths
     *
     */
    const buildComponentSetFromSource = Effect.fn('MetadataRetrieveService.buildComponentSetFromSource')(function* (
      sourcePaths: string[],
      filterMembers: MetadataMember[]
    ) {
      yield* Effect.annotateCurrentSpan({ filterMembers, sourcePaths });
      const registryAccess = yield* metadataRegistryService.getRegistryAccess();
      const include = filterMembers.length > 0 ? yield* buildComponentSet(filterMembers) : undefined;
      const cs = yield* Effect.try({
        try: () => ComponentSet.fromSource({ fsPaths: sourcePaths, include, registry: registryAccess }),
        catch: e => {
          const { cause } = unknownToErrorCause(e);
          return new FailedToBuildComponentSetError({
            message: `Failed to build ComponentSet from source: ${cause.message}`,
            cause
          });
        }
      });
      yield* Effect.annotateCurrentSpan({ size: cs.size });
      return cs;
    });

    /** Shared helper to perform the actual retrieve operation */
    const performRetrieveOperation = Effect.fn('MetadataRetrieveService.performRetrieveOperation')(function* (
      input: PerformRetrieveOperationInput
    ) {
      const output = input.merge ? input.project.getDefaultPackage().fullPath : uriToPath(input.outputPath);
      yield* Effect.annotateCurrentSpan({ output });
      const runtime = yield* Effect.runtime();
      const retrieveFiber = yield* Effect.tryPromise({
        try: async () => {
          const retrieveOperation = new MetadataApiRetrieve({
            usernameOrConnection: input.connection,
            components: input.componentSet,
            output,
            format: 'source',
            merge: input.merge,
            registry: input.registryAccess
          });

          const retrieveResult = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: input.title,
              cancellable: true
            },
            async (_, token) => {
              token.onCancellationRequested(async () => {
                await retrieveOperation.cancel();
                await Fiber.interrupt(retrieveFiber).pipe(Runtime.runPromise(runtime));
              });
              await retrieveOperation.start();
              return await retrieveOperation.pollStatus();
            }
          );
          return retrieveResult;
        },
        catch: e => {
          console.error(e);
          return new MetadataRetrieveError(unknownToErrorCause(e));
        }
      }).pipe(Effect.withSpan('retrieve (API call)'), Effect.fork);

      const retrieveOutcome = yield* Effect.matchCauseEffect(Fiber.join(retrieveFiber), {
        onFailure: cause =>
          Cause.isInterruptedOnly(cause)
            ? Effect.fail<UserCancellationError | MetadataRetrieveError>(new UserCancellationError())
            : Effect.failCause(cause),
        onSuccess: outcome => Effect.succeed(outcome)
      });

      yield* Effect.annotateCurrentSpan({
        retrieveOutcome,
        fileResponses: retrieveOutcome.getFileResponses().map(r => r.filePath)
      });
      // only do tracking in the case where we retrieve to project
      if (input.merge) {
        yield* Effect.all(
          [
            sourceTrackingService
              .maybeUpdateTrackingFromRetrieve(retrieveOutcome, input.expectedOrgId)
              .pipe(Effect.withSpan('MetadataRetrieveService.maybeUpdateTrackingFromRetrieve')),
            publishRetrieveNotifications(retrieveOutcome, input.expectedOrgId)
          ],
          { concurrency: 'unbounded', discard: true }
        );
      }

      return retrieveOutcome;
    });

    /** Retrieve one or more metadata components from the default org. */
    const retrieve = Effect.fn('MetadataRetrieveService.retrieve')(function* (
      members: MetadataMember[],
      options?: MetadataRetrieveOptions
    ) {
      const [connection, project, registryAccess, componentSet, hasTracking] = yield* Effect.all(
        [
          options?.expectedOrgId
            ? connectionService.getConnectionForOrg(options.expectedOrgId)
            : connectionService.getConnection(),
          projectService.getSfProject(),
          metadataRegistryService.getRegistryAccess(),
          buildComponentSet(members),
          sourceTrackingService.hasTracking(options?.expectedOrgId),
          workspaceService.getWorkspaceInfoOrThrow()
        ],
        { concurrency: 'unbounded' }
      );

      if (hasTracking && !options?.ignoreConflicts) {
        yield* sourceTrackingService.checkConflicts(options?.expectedOrgId);
      }

      const title = `Retrieving ${members.map(m => `${m.type}: ${m.fullName === '*' ? 'all' : m.fullName}`).join(', ')}`;
      return yield* performRetrieveOperation({
        componentSet,
        connection,
        registryAccess,
        title,
        merge: true,
        project,
        expectedOrgId: options?.expectedOrgId ?? connection.getAuthInfoFields().orgId
      });
    }, withActiveMetadataOperationPipeline);

    /** Retrieve metadata using a ComponentSet directly.
     * Sets project directory and API versions on the ComponentSet before retrieving.
     */
    const retrieveComponentSet = Effect.fn('MetadataRetrieveService.retrieveComponentSet')(function* (
      components: ComponentSet,
      options?: MetadataRetrieveOptions
    ) {
      yield* Effect.annotateCurrentSpan({ components: components.size });
      const registryAccess = yield* metadataRegistryService.getRegistryAccess();
      const [connection, project, configAggregator, , hasTracking] = yield* Effect.all(
        [
          options?.expectedOrgId
            ? connectionService.getConnectionForOrg(options.expectedOrgId)
            : connectionService.getConnection(),
          projectService.getSfProject(),
          configService.getConfigAggregator(),
          workspaceService.getWorkspaceInfoOrThrow(),
          sourceTrackingService.hasTracking(options?.expectedOrgId)
        ],
        { concurrency: 'unbounded' }
      );

      yield* setComponentSetProperties({ componentSet: components, project, configAggregator });
      if (hasTracking && !options?.ignoreConflicts) {
        yield* sourceTrackingService.checkConflicts(options?.expectedOrgId);
      }

      const title = `Retrieving ${components.size} component${components.size === 1 ? '' : 's'}`;
      return yield* performRetrieveOperation({
        componentSet: components,
        connection,
        registryAccess,
        title,
        merge: true,
        project,
        expectedOrgId: options?.expectedOrgId ?? connection.getAuthInfoFields().orgId
      });
    }, withActiveMetadataOperationPipeline);

    /** Retrieve metadata using a ComponentSet directly to a custom output directory.
     * Sets project directory and API versions on the ComponentSet before retrieving.
     */
    const retrieveComponentSetToDirectory = Effect.fn('MetadataRetrieveService.retrieveComponentSetToDirectory')(
      function* (components: NonEmptyComponentSet, outputPath: URI, expectedOrgId?: string) {
        const registryAccess = yield* metadataRegistryService.getRegistryAccess();
        const [connection, project, configAggregator] = yield* Effect.all(
          [
            expectedOrgId ? connectionService.getConnectionForOrg(expectedOrgId) : connectionService.getConnection(),
            projectService.getSfProject(),
            configService.getConfigAggregator(),
            workspaceService.getWorkspaceInfoOrThrow()
          ],
          { concurrency: 'unbounded' }
        );
        // Set API versions and use output directory as projectDirectory when merge is false
        // This ensures components resolved from the output directory have correct paths
        yield* setComponentSetProperties({
          componentSet: components,
          configAggregator,
          project,
          directory: outputPath
        });
        return yield* performRetrieveOperation({
          componentSet: components,
          connection,
          registryAccess,
          title: `Retrieving ${components.size} component${components.size === 1 ? '' : 's'} for diff`,
          merge: false,
          outputPath,
          expectedOrgId
        });
      }
    );

    return {
      retrieve,
      retrieveComponentSet,
      retrieveComponentSetToDirectory,
      buildComponentSet,
      buildComponentSetFromSource
    };
  })
}) {}
