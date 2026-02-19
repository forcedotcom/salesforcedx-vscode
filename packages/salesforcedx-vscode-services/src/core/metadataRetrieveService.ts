/*
 * Copyright (c) 2025, salesforce.com, inc.
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

import * as Brand from 'effect/Brand';
import * as Cause from 'effect/Cause';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { SuccessfulCancelResult } from '../vscode/cancellation';
import { uriToPath } from '../vscode/paths';
import { WorkspaceService } from '../vscode/workspaceService';
import { FailedToBuildComponentSetError, NonEmptyComponentSet, setComponentSetProperties } from './componentSetService';
import { ConfigService } from './configService';
import { ConnectionService } from './connectionService';
import { MetadataRegistryService } from './metadataRegistryService';
import { ProjectService } from './projectService';
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

export class MetadataRetrieveService extends Effect.Service<MetadataRetrieveService>()('MetadataRetrieveService', {
  accessors: true,
  dependencies: [
    WorkspaceService.Default,
    ConnectionService.Default,
    SourceTrackingService.Default,
    MetadataRegistryService.Default,
    ProjectService.Default,
    ConfigService.Default
  ],
  effect: Effect.gen(function* () {
    const workspaceService = yield* WorkspaceService;
    const connectionService = yield* ConnectionService;
    const sourceTrackingService = yield* SourceTrackingService;
    const projectService = yield* ProjectService;
    const configService = yield* ConfigService;
    const registryAccess = yield* MetadataRegistryService.getRegistryAccess();

    const buildComponentSet = Effect.fn('MetadataRetrieveService.buildComponentSet')(function* (
      members: MetadataMember[]
    ) {
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
                await Effect.runPromise(Fiber.interrupt(retrieveFiber));
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
            ? Effect.succeed(Brand.nominal<SuccessfulCancelResult>()('User canceled'))
            : Effect.failCause(cause),
        onSuccess: outcome => Effect.succeed(outcome)
      });

      yield* Effect.annotateCurrentSpan({ retrieveOutcome });
      if (typeof retrieveOutcome === 'string') {
        return retrieveOutcome;
      }

      yield* Effect.annotateCurrentSpan({
        fileResponses: retrieveOutcome.getFileResponses().map(r => r.filePath)
      });
      // only do tracking in the case where we retrieve to project
      if (input.merge) {
        yield* sourceTrackingService
          .updateTrackingFromRetrieve(retrieveOutcome)
          .pipe(Effect.withSpan('MetadataRetrieveService.updateTrackingFromRetrieve'));
      }

      return retrieveOutcome;
    });

    /** Retrieve one or more metadata components from the default org. */
    const retrieve = Effect.fn('MetadataRetrieveService.retrieve')(function* (
      members: MetadataMember[],
      options?: SourceTrackingOptions
    ) {
      const [connection, project] = yield* Effect.all(
        [connectionService.getConnection(), projectService.getSfProject(), workspaceService.getWorkspaceInfoOrThrow()],
        { concurrency: 'unbounded' }
      );

      const componentSet = yield* buildComponentSet(members);

      const title = `Retrieving ${members.map(m => `${m.type}: ${m.fullName === '*' ? 'all' : m.fullName}`).join(', ')}`;

      const tracking = yield* sourceTrackingService.getSourceTracking(options);

      if (tracking) {
        yield* Effect.promise(() =>
          vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title, cancellable: false },
            () => tracking.reReadLocalTrackingCache()
          )
        ).pipe(Effect.withSpan('STL.ReReadLocalTrackingCache'));

        if (!options?.ignoreConflicts) {
          yield* sourceTrackingService.checkConflicts(tracking);
        }
      }

      return yield* performRetrieveOperation({ componentSet, connection, registryAccess, title, merge: true, project });
    });

    /** Retrieve metadata using a ComponentSet directly.
     * Sets project directory and API versions on the ComponentSet before retrieving.
     */
    const retrieveComponentSet = Effect.fn('MetadataRetrieveService.retrieveComponentSet')(function* (
      components: ComponentSet,
      options?: SourceTrackingOptions
    ) {
      yield* Effect.annotateCurrentSpan({ components: components.size });
      const [connection, project, configAggregator] = yield* Effect.all(
        [
          connectionService.getConnection(),
          projectService.getSfProject(),
          configService.getConfigAggregator(),
          workspaceService.getWorkspaceInfoOrThrow()
        ],
        { concurrency: 'unbounded' }
      );

      yield* setComponentSetProperties({ componentSet: components, project, configAggregator });

      const tracking = yield* sourceTrackingService.getSourceTracking(options);
      if (tracking) {
        yield* Effect.promise(() => tracking.reReadLocalTrackingCache()).pipe(
          Effect.withSpan('STL.ReReadLocalTrackingCache')
        );

        if (!options?.ignoreConflicts) {
          yield* sourceTrackingService.checkConflicts(tracking);
        }
      }

      const title = `Retrieving ${components.size} component${components.size === 1 ? '' : 's'}`;
      return yield* performRetrieveOperation({
        componentSet: components,
        connection,
        registryAccess,
        title,
        merge: true,
        project
      });
    });

    /** Retrieve metadata using a ComponentSet directly to a custom output directory.
     * Sets project directory and API versions on the ComponentSet before retrieving.
     */
    const retrieveComponentSetToDirectory = Effect.fn('MetadataRetrieveService.retrieveComponentSetToDirectory')(
      function* (components: NonEmptyComponentSet, outputPath: URI) {
        const [connection, project, configAggregator] = yield* Effect.all(
          [
            connectionService.getConnection(),
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
          outputPath
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
