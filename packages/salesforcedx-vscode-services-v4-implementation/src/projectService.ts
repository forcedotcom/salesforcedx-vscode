/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Global, SfProject } from '@salesforce/core';
import {
  FailedToResolveSfProjectError,
  NotInPackageDirectoryError,
  ProjectService,
  WorkspaceService,
  artifactNamespacesEqual,
  type ArtifactNamespace,
  type FileChangeEvent,
  type WorkspaceInfo
} from '@salesforce/vscode-services-v2';
import { isUriEqualOrWithin } from '@salesforce/vscode-services-v2/uriComparison';
import * as Cache from 'effect/Cache';
import * as Context from 'effect/Context';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as PubSub from 'effect/PubSub';
import * as Ref from 'effect/Ref';
import * as Semaphore from 'effect/Semaphore';
import * as Stream from 'effect/Stream';
// SDK filesystem keys preserve native drive/trailing-slash semantics; URI normalization changes them.
import { normalize } from 'node:path';
import * as vscode from 'vscode';
import { type URI, Utils } from 'vscode-uri';
import { unknownToErrorCause } from './errorCause.js';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';
import { toUri } from './uriUtils.js';

const canonicalProjectNamespace = (value: unknown): ArtifactNamespace =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
const isWorkspaceNamespaceEligible = (requested: ArtifactNamespace, project: ArtifactNamespace): boolean =>
  artifactNamespacesEqual(requested, project);

/** Internal publisher: invalidate both caches before exposing the root-project event. */
export class ProjectFileChanges extends Context.Service<
  ProjectFileChanges,
  {
    readonly handle: (event: FileChangeEvent) => Effect.Effect<void>;
  }
>()('@salesforce/vscode-services-v4-implementation/ProjectFileChanges') {}

const resolveSfProject = (fsPath: string) =>
  Effect.tryPromise({
    try: () => SfProject.resolve(fsPath),
    catch: error => {
      const { cause } = unknownToErrorCause(error);
      // Core already supplies the complete, user-readable sentence; do not double the path.
      return new FailedToResolveSfProjectError({ message: cause.message, cause });
    }
  }).pipe(
    Effect.withSpan('resolveSfProject', { attributes: { fsPath } }),
    // SDK resolve writes its static instance cache and cannot abort; settle before owner cleanup clears it.
    Effect.uninterruptible
  );

/** Web test mounts are unreadable by Node resolve; headless servers publish the actual disk root here. */
const readVsCodeTestWebDiskRootMarker = Effect.promise(async (): Promise<string | undefined> => {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (folder?.uri.scheme !== 'vscode-test-web') return undefined;
  return Promise.resolve(
    vscode.workspace.fs.readFile(vscode.Uri.joinPath(folder.uri, '.vscode', 'vscode-extension-test-disk-root.txt'))
  ).then(
    buffer => (buffer === undefined ? undefined : Buffer.from(buffer).toString('utf8').trim() || undefined),
    () => undefined
  );
}).pipe(Effect.withSpan('readVsCodeTestWebDiskRootMarker'));
const workspaceRootSalesforceManifestExistsViaVscodeFs = Effect.promise(async () => {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return false;
  return Promise.resolve(vscode.workspace.fs.stat(vscode.Uri.joinPath(folder.uri, 'sfdx-project.json'))).then(
    stat => stat?.type === vscode.FileType.File,
    () => false
  );
}).pipe(Effect.withSpan('workspaceRootSalesforceManifestExistsViaVscodeFs'));

export const ProjectServiceLayer = Layer.effectContext(
  Effect.gen(function* () {
    const workspace = yield* WorkspaceService;
    const operations = yield* ServiceOperations;
    const opened = yield* Ref.make<boolean | undefined>(undefined);
    const contextPermit = yield* Semaphore.make(1);
    const events = yield* Effect.acquireRelease(PubSub.sliding<FileChangeEvent>(100), PubSub.shutdown);
    const cache = yield* Cache.makeWith(resolveSfProject, {
      capacity: 10,
      timeToLive: exit => (Exit.isSuccess(exit) ? Duration.minutes(10) : Duration.zero)
    }).pipe(Effect.withSpan('sfProjectCache'));
    yield* Effect.addFinalizer(() =>
      Cache.invalidateAll(cache).pipe(Effect.andThen(Effect.sync(() => SfProject.clearInstances())))
    );

    const cacheKey = (fsPath: string) =>
      readVsCodeTestWebDiskRootMarker.pipe(Effect.map(marker => marker ?? normalize(fsPath)));
    const setOpened = Effect.fn('setProjectOpenedContext')((value: boolean, reason: string, selected: WorkspaceInfo) =>
      contextPermit.withPermit(
        Effect.uninterruptible(
          Effect.gen(function* () {
            const current = yield* workspace.getWorkspaceInfo();
            if (current.isEmpty !== selected.isEmpty || current.uri.toString() !== selected.uri.toString()) return;
            const changed = yield* Ref.modify(opened, previous =>
              previous === value ? ([false, previous] as const) : ([true, value] as const)
            );
            yield* Effect.annotateCurrentSpan({ value, reason, changed });
            if (!changed) return;
            yield* Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:project_opened', value));
            yield* Effect.logInfo(`[ProjectService] sf:project_opened=${String(value)} reason=${reason}`);
          })
        )
      )
    );
    const isSalesforceProject = Effect.fn('ProjectService.isSalesforceProject')(function* () {
      const info = yield* workspace.getWorkspaceInfo();
      if (info.isEmpty) {
        yield* setOpened(false, 'workspace_empty', info);
        return false;
      }
      return yield* cacheKey(info.fsPath).pipe(
        Effect.flatMap(key => Cache.get(cache, key)),
        Effect.tap(() => setOpened(true, 'workspace_non_empty', info)),
        Effect.tapError(() => setOpened(false, 'workspace_empty', info)),
        Effect.as(true),
        Effect.catchTag('FailedToResolveSfProjectError', () =>
          workspaceRootSalesforceManifestExistsViaVscodeFs.pipe(
            Effect.tap(exists => setOpened(exists, 'workspace_non_empty', info))
          )
        )
      );
    }, operations.run);
    const getSfProject = Effect.fn('ProjectService.getSfProject')(function* () {
      const info = yield* workspace.getWorkspaceInfoOrThrow();
      const project = yield* cacheKey(info.fsPath).pipe(
        Effect.flatMap(key => Cache.get(cache, key)),
        Effect.tapError(() => setOpened(false, 'workspace_empty', info))
      );
      yield* setOpened(true, 'workspace_non_empty', info);
      return project;
    }, operations.run);
    const getProjectNamespace = Effect.fn('ProjectService.getProjectNamespace')(
      () =>
        getSfProject().pipe(
          Effect.map(project => canonicalProjectNamespace(project.getSfProjectJson().getContents().namespace))
        ),
      operations.run
    );
    const isInPackageDirectories = Effect.fn('ProjectService.isInPackageDirectories')(function* (uri: URI) {
      return (
        (yield* isSalesforceProject()) &&
        (yield* getSfProject())
          .getPackageDirectories()
          .some(directory => isUriEqualOrWithin(toUri(directory.fullPath), uri))
      );
    }, operations.run);
    const getStateFolder = Effect.fn('ProjectService.getStateFolder')(
      () =>
        workspace
          .getWorkspaceInfoOrThrow()
          .pipe(Effect.map(info => Utils.joinPath(info.uri, Global.SFDX_STATE_FOLDER))),
      operations.run
    );
    const toolsPath = (...segments: string[]) =>
      getStateFolder().pipe(Effect.map(uri => Utils.joinPath(uri, 'tools', ...segments)));
    const service = ProjectService.of({
      isSalesforceProject,
      getSfProject,
      getProjectNamespace,
      isInPackageDirectories,
      projectConfigChanges: Stream.fromPubSub(events),
      isArtifactNamespaceWorkspaceEligible: Effect.fn('ProjectService.isArtifactNamespaceWorkspaceEligible')(function* (
        requested: ArtifactNamespace
      ) {
        return isWorkspaceNamespaceEligible(requested, yield* getProjectNamespace());
      }, operations.run),
      ensureInPackageDirectories: Effect.fn('ProjectService.ensureInPackageDirectories')(function* (
        uris: readonly URI[]
      ) {
        const outside = yield* Stream.fromIterable(uris).pipe(
          Stream.filterEffect(uri => isInPackageDirectories(uri).pipe(Effect.map(value => !value))),
          Stream.runCollect
        );
        if (outside.length > 0)
          return yield* new NotInPackageDirectoryError({
            message: 'Only files in a Salesforce package directory can be used with this command',
            uris: outside
          });
      }, operations.run),
      getStateFolder,
      getSoqlMetadataPath: Effect.fn('ProjectService.getSoqlMetadataPath')(
        () => toolsPath('soqlMetadata'),
        operations.run
      ),
      getSoqlStandardObjectsPath: Effect.fn('ProjectService.getSoqlStandardObjectsPath')(
        () => toolsPath('soqlMetadata', 'standardObjects'),
        operations.run
      ),
      getSoqlCustomObjectsPath: Effect.fn('ProjectService.getSoqlCustomObjectsPath')(
        () => toolsPath('soqlMetadata', 'customObjects'),
        operations.run
      ),
      getFauxClassesPath: Effect.fn('ProjectService.getFauxClassesPath')(() => toolsPath('sobjects'), operations.run),
      getFauxStandardObjectsPath: Effect.fn('ProjectService.getFauxStandardObjectsPath')(
        () => toolsPath('sobjects', 'standardObjects'),
        operations.run
      ),
      getFauxCustomObjectsPath: Effect.fn('ProjectService.getFauxCustomObjectsPath')(
        () => toolsPath('sobjects', 'customObjects'),
        operations.run
      ),
      getTypingsPath: Effect.fn('ProjectService.getTypingsPath')(
        () => getStateFolder().pipe(Effect.map(uri => Utils.joinPath(uri, 'typings', 'lwc', 'sobjects'))),
        operations.run
      ),
      getDebugLogsFolder: Effect.fn('ProjectService.getDebugLogsFolder')(
        () => toolsPath('debug', 'logs'),
        operations.run
      ),
      getApexTestResultsFolder: Effect.fn('ProjectService.getApexTestResultsFolder')(
        () => toolsPath('testresults', 'apex'),
        operations.run
      )
    });
    const handle = Effect.fn('watchSfProjectFile')(function* (event: FileChangeEvent) {
      const info = yield* workspace.getWorkspaceInfo();
      if (info.isEmpty || event.uri.toString() !== Utils.joinPath(info.uri, 'sfdx-project.json').toString()) return;
      const key = yield* cacheKey(info.fsPath);
      // SDK SfProject memoizes parsed JSON in a static map; both caches must be invalidated before publication.
      yield* Cache.invalidate(cache, key).pipe(
        Effect.andThen(Effect.sync(() => SfProject.clearInstances())),
        Effect.andThen(PubSub.publish(events, event)),
        Effect.flatMap(published => (published ? Effect.void : Effect.interrupt)),
        Effect.uninterruptible
      );
    }, operations.run);
    yield* Effect.addFinalizer(() => operations.close);
    return Context.make(ProjectService, service).pipe(Context.add(ProjectFileChanges, { handle }));
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
