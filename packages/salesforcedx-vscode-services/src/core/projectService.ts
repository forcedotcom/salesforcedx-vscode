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
import * as Exit from 'effect/Exit';
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

const setProjectOpenedContext = (value: boolean, reason: string) =>
  Effect.promise(async () => {
    await vscode.commands.executeCommand('setContext', 'sf:project_opened', value);
    console.info(`[ProjectService] sf:project_opened=${String(value)} reason=${reason}`);
  }).pipe(Effect.withSpan('setProjectOpenedContext', { attributes: { value, reason } }));

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
  Cache.makeWith({
    capacity: 10,
    timeToLive: Exit.match({
      onSuccess: () => Duration.minutes(10), // Projects expire after 10 minutes (project structure changes are infrequent)
      onFailure: () => Duration.zero
    }),
    lookup: resolveSfProject
  }).pipe(Effect.withSpan('sfProjectCache'))
);

const TOOLS_DIR = 'tools';
const SOBJECTS_DIR = 'sobjects';
const STANDARDOBJECTS_DIR = 'standardObjects';
const CUSTOMOBJECTS_DIR = 'customObjects';
const SOQLMETADATA_DIR = 'soqlMetadata';
const TYPINGS_SEGMENTS = ['typings', 'lwc', 'sobjects'] as const;

/** Playwright `vscode-test-web` mounts use `vscode-test-web://…`; `uri.fsPath` is `/`, so Node `SfProject.resolve` uses this marker (written by extension E2E headless servers before the web server starts). */
const readVsCodeTestWebDiskRootMarker = Effect.promise(async (): Promise<string | undefined> => {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length || folders[0].uri.scheme !== 'vscode-test-web') {
    return undefined;
  }
  const markerUri = vscode.Uri.joinPath(folders[0].uri, '.vscode', 'vscode-extension-test-disk-root.txt');
  const { fs } = vscode.workspace;
  if (typeof fs?.readFile !== 'function') {
    return undefined;
  }
  // Jest may stub `readFile` as a no-op returning undefined; `Promise.resolve` normalizes non-Thenables.
  return await Promise.resolve(fs.readFile(markerUri)).then(
    buf => {
      if (buf == null) {
        return undefined;
      }
      const text = Buffer.from(buf).toString('utf8').trim();
      return text.length > 0 ? text : undefined;
    },
    () => undefined
  );
}).pipe(Effect.withSpan('readVsCodeTestWebDiskRootMarker'));

/** VS Code Web test mounts are not readable by Node `SfProject.resolve`; used when resolve fails on the disk key. */
const workspaceRootSalesforceManifestExistsViaVscodeFs = Effect.promise(async (): Promise<boolean> => {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    return false;
  }
  const uri = vscode.Uri.joinPath(folders[0].uri, 'sfdx-project.json');
  const { fs } = vscode.workspace;
  if (typeof fs?.stat !== 'function') {
    return false;
  }
  return await Promise.resolve(fs.stat(uri)).then(
    s => s != null && typeof s === 'object' && 'type' in s && s.type === vscode.FileType.File,
    () => false
  );
}).pipe(Effect.withSpan('workspaceRootSalesforceManifestExistsViaVscodeFs'));

export class ProjectService extends Effect.Service<ProjectService>()('ProjectService', {
  accessors: true,
  dependencies: [WorkspaceService.Default],
  effect: Effect.gen(function* () {
    const workspaceService = yield* WorkspaceService;

    /** Check if we're in a Salesforce project (sfdx-project.json exists).  Side effect: sets the 'sf:project_opened' context to true or false */
    const isSalesforceProject = Effect.fn('ProjectService.isSalesforceProject')(function* () {
      const workspaceDescription = yield* workspaceService.getWorkspaceInfo();

      if (workspaceDescription.isEmpty) {
        yield* setProjectOpenedContext(false, 'workspace_empty');
        return false;
      }

      const markerPath = yield* readVsCodeTestWebDiskRootMarker;
      const cacheKey = markerPath ?? workspaceDescription.fsPath;

      return yield* globalSfProjectCache.get(cacheKey).pipe(
        Effect.tap(() => setProjectOpenedContext(true, 'workspace_non_empty')),
        Effect.tapError(() => setProjectOpenedContext(false, 'workspace_empty')),
        Effect.map(() => true),
        Effect.catchTag('FailedToResolveSfProjectError', () =>
          Effect.gen(function* () {
            const viaVscodeFs = yield* workspaceRootSalesforceManifestExistsViaVscodeFs;
            yield* setProjectOpenedContext(viaVscodeFs, 'workspace_non_empty');
            return viaVscodeFs;
          })
        )
      );
    });

    /** Get the SfProject instance for the workspace (fails if not a Salesforce project).  Side effect: sets the 'sf:project_opened' context to true or false */
    const getSfProject = Effect.fn('ProjectService.getSfProject')(function* () {
      const markerPath = yield* readVsCodeTestWebDiskRootMarker;
      const workspacePath = (yield* workspaceService.getWorkspaceInfoOrThrow()).fsPath;
      const cacheKey = markerPath ?? workspacePath;
      const project = yield* globalSfProjectCache
        .get(cacheKey)
        .pipe(Effect.tapError(() => setProjectOpenedContext(false, 'workspace_empty')));
      yield* setProjectOpenedContext(true, 'workspace_non_empty');
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
              // Use URI.path which is normalized (always uses /) regardless of OS.
              // Compare case-insensitively: VS Code provides uppercase drive letters on
              // Windows (e.g. /C:/...) while vscode-uri normalizes to lowercase (/c:/...).
              uri.path.toLowerCase().startsWith(`${dir.toLowerCase()}/`) || uri.path.toLowerCase() === dir.toLowerCase()
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

export class NotInPackageDirectoryError extends Data.TaggedError('NotInPackageDirectoryError')<{
  readonly message: string;
  readonly uris: readonly URI[];
}> {}
