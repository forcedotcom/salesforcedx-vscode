/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Global, SfProject } from '@salesforce/core';
import * as Cache from 'effect/Cache';
import * as Chunk from 'effect/Chunk';
import * as Data from 'effect/Data';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { toUri } from '../vscode/uriUtils';
import { WorkspaceService } from '../vscode/workspaceService';
import { unknownToErrorCause } from './shared';

export class FailedToResolveSfProjectError extends Schema.TaggedError<FailedToResolveSfProjectError>()(
  'FailedToResolveSfProjectError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.instanceOf(Error))
  }
) {}

const setProjectOpenedContext = (value: boolean) =>
  Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:project_opened', value)).pipe(
    Effect.withSpan('setProjectOpenedContext', { attributes: { value } })
  );

const resolveSfProject = (fsPath: string) =>
  Effect.tryPromise({
    try: () => SfProject.resolve(fsPath),
    catch: error => {
      const { cause } = unknownToErrorCause(error);
      return new FailedToResolveSfProjectError({
        message: `Failed to resolve SfProject at "${fsPath}": ${cause.message}`,
        cause
      });
    }
  }).pipe(Effect.withSpan('resolveSfProject', { attributes: { fsPath } }));

// Global cache - created once at module level, not scoped to any consumer
const globalSfProjectCache = Effect.runSync(
  Cache.make({
    capacity: 10, // Maximum number of cached SfProject instances
    timeToLive: Duration.minutes(10), // Projects expire after 10 minutes (project structure changes are infrequent)
    lookup: resolveSfProject // Lookup function that resolves SfProject for given fsPath
  }).pipe(Effect.withSpan('sfProjectCache'))
);

const TOOLS_DIR = 'tools';
const SOBJECTS_DIR = 'sobjects';
const STANDARDOBJECTS_DIR = 'standardObjects';
const CUSTOMOBJECTS_DIR = 'customObjects';
const SOQLMETADATA_DIR = 'soqlMetadata';
const TYPINGS_SEGMENTS = ['typings', 'lwc', 'sobjects'] as const;

export class ProjectService extends Effect.Service<ProjectService>()('ProjectService', {
  accessors: true,
  dependencies: [WorkspaceService.Default],
  effect: Effect.gen(function* () {
    const workspaceService = yield* WorkspaceService;

    /** Check if we're in a Salesforce project (sfdx-project.json exists).  Side effect: sets the 'sf:project_opened' context to true or false */
    const isSalesforceProject = Effect.fn('ProjectService.isSalesforceProject')(function* () {
      const workspaceDescription = yield* workspaceService.getWorkspaceInfo();

      if (workspaceDescription.isEmpty) {
        yield* setProjectOpenedContext(false);
        return false;
      }

      return yield* globalSfProjectCache.get(workspaceDescription.fsPath).pipe(
        Effect.tap(() => setProjectOpenedContext(true)),
        Effect.tapError(() => setProjectOpenedContext(false)),
        Effect.map(() => true),
        Effect.catchTag('FailedToResolveSfProjectError', () => Effect.succeed(false))
      );
    });

    /** Get the SfProject instance for the workspace (fails if not a Salesforce project).  Side effect: sets the 'sf:project_opened' context to true or false */
    const getSfProject = Effect.fn('ProjectService.getSfProject')(function* () {
      const workspacePath = (yield* workspaceService.getWorkspaceInfoOrThrow()).fsPath;
      const project = yield* globalSfProjectCache
        .get(workspacePath)
        .pipe(Effect.tapError(() => setProjectOpenedContext(false)));
      yield* setProjectOpenedContext(true);
      return project;
    });

    /** Check if a URI is within any package directory */
    const isInPackageDirectories = Effect.fn('ProjectService.isInPackageDirectories')(function* (uri: URI) {
      return (
        (yield* isSalesforceProject()) &&
        (yield* getSfProject())
          .getPackageDirectories()
          // normalizes paths to forward slashes
          .map(dir => toUri(dir.fullPath).path)
          // Remove trailing forwardslash if present
          .map(dir => dir.replace(/\/$/, ''))
          .some(
            dir =>
              // Use URI.path which is normalized (always uses /) regardless of OS
              uri.path.startsWith(`${dir}/`) || uri.path === dir
          )
      );
    });

    /** Fail with NotInPackageDirectoryError if any of the given URIs are outside package directories */
    const ensureInPackageDirectories = Effect.fn('ProjectService.ensureInPackageDirectories')(function* (uris: URI[]) {
      const outOfPackage = yield* Stream.fromIterable(uris).pipe(
        Stream.filterEffect(uri => isInPackageDirectories(uri).pipe(Effect.map(b => !b))),
        Stream.runCollect
      );
      yield* Chunk.isEmpty(outOfPackage)
        ? Effect.void
        : new NotInPackageDirectoryError({
            message: 'Only files in a Salesforce package directory can be used with this command',
            uris: Chunk.toReadonlyArray(outOfPackage)
          });
    });

    const getToolsFolder = Effect.fn('ProjectService.getToolsFolder')(function* () {
      const { uri } = yield* workspaceService.getWorkspaceInfoOrThrow();
      return Utils.joinPath(uri, Global.SFDX_STATE_FOLDER, TOOLS_DIR);
    });

    const getSoqlMetadataPath = Effect.fn('ProjectService.getSoqlMetadataPath')(function* () {
      return Utils.joinPath(yield* getToolsFolder(), SOQLMETADATA_DIR);
    });

    const getSoqlStandardObjectsPath = Effect.fn('ProjectService.getSoqlStandardObjectsPath')(function* () {
      return Utils.joinPath(yield* getToolsFolder(), SOQLMETADATA_DIR, STANDARDOBJECTS_DIR);
    });

    const getSoqlCustomObjectsPath = Effect.fn('ProjectService.getSoqlCustomObjectsPath')(function* () {
      return Utils.joinPath(yield* getToolsFolder(), SOQLMETADATA_DIR, CUSTOMOBJECTS_DIR);
    });

    const getFauxClassesPath = Effect.fn('ProjectService.getFauxClassesPath')(function* () {
      return Utils.joinPath(yield* getToolsFolder(), SOBJECTS_DIR);
    });

    const getFauxStandardObjectsPath = Effect.fn('ProjectService.getFauxStandardObjectsPath')(function* () {
      return Utils.joinPath(yield* getToolsFolder(), SOBJECTS_DIR, STANDARDOBJECTS_DIR);
    });

    const getFauxCustomObjectsPath = Effect.fn('ProjectService.getFauxCustomObjectsPath')(function* () {
      return Utils.joinPath(yield* getToolsFolder(), SOBJECTS_DIR, CUSTOMOBJECTS_DIR);
    });

    const getTypingsPath = Effect.fn('ProjectService.getTypingsPath')(function* () {
      const { uri } = yield* workspaceService.getWorkspaceInfoOrThrow();
      return Utils.joinPath(uri, Global.SFDX_STATE_FOLDER, ...TYPINGS_SEGMENTS);
    });

    return {
      isSalesforceProject,
      getSfProject,
      isInPackageDirectories,
      ensureInPackageDirectories,
      getSoqlMetadataPath,
      getSoqlStandardObjectsPath,
      getSoqlCustomObjectsPath,
      getFauxClassesPath,
      getFauxStandardObjectsPath,
      getFauxCustomObjectsPath,
      getTypingsPath
    };
  })
}) {}

export class NoWorkspaceOpenError extends Data.TaggedError('NoWorkspaceOpenError')<{}> {}

export class NotInPackageDirectoryError extends Data.TaggedError('NotInPackageDirectoryError')<{
  readonly message: string;
  readonly uris: readonly URI[];
}> {}
