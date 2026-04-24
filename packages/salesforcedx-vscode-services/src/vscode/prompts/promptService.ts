/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Equal from 'effect/Equal';
import { isString } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { type URI, Utils } from 'vscode-uri';
import { ProjectService } from '../../core/projectService';
import { nls } from '../../messages';
import { FsService } from '../fsService';
import { HashableUri } from '../hashableUri';
import { toUri } from '../uriUtils';
import { WorkspaceService } from '../workspaceService';

export class UserCancellationError extends Schema.TaggedError<UserCancellationError>()('UserCancellationError', {
  message: Schema.optional(Schema.String).pipe(
    Schema.withDefaults({
      constructor: () => 'User cancelled',
      decoding: () => 'User cancelled'
    })
  )
}) {}

export class PromptService extends Effect.Service<PromptService>()('PromptService', {
  accessors: false,
  dependencies: [FsService.Default, ProjectService.Default, WorkspaceService.Default],
  effect: Effect.gen(function* () {
    const fsService = yield* FsService;
    const projectService = yield* ProjectService;
    const workspaceService = yield* WorkspaceService;

    /** If any of `uris` exists, prompt to overwrite; on cancel fail with {@link UserCancellationError}.
     * This is shared across metadata types (Apex, SOQL, LWC, Manifest, etc). */
    const ensureMetadataOverwriteOrThrow = Effect.fn('PromptService.ensureMetadataOverwriteOrThrow')(
      function* (params: { readonly uris: readonly URI[] }) {
        const firstExistingUri = yield* Effect.forEach(
          params.uris,
          uri => fsService.fileOrFolderExists(uri).pipe(Effect.map(exists => (exists ? uri : undefined))),
          { concurrency: 'unbounded' }
        ).pipe(Effect.map(matches => matches.find(match => match !== undefined)));
        if (!firstExistingUri) return;

        const placeholder = yield* fsService.uriToPath(firstExistingUri);

        const choice = yield* Effect.promise(() =>
          vscode.window.showWarningMessage(
            nls.localize('metadata_overwrite_confirmation', placeholder),
            { modal: true },
            nls.localize('overwrite_button')
          )
        );

        if (choice !== nls.localize('overwrite_button'))
          return yield* new UserCancellationError({ message: 'User cancelled overwrite' });
      }
    );

    /** If `value` is undefined (or an empty trimmed string), fail with {@link UserCancellationError}.
     * Otherwise, return `value` with `undefined` removed from its type. */
    const considerUndefinedAsCancellation: <T>(
      value: T | undefined
    ) => Effect.Effect<T, UserCancellationError, never> = value =>
      value === undefined || (isString(value) && value.trim().length === 0)
        ? Effect.fail(new UserCancellationError())
        : Effect.succeed(value);

    /** BFS search for all directories named `folderName` under `rootUri`. Swallows read errors on any subtree. */
    const findFoldersByName = (rootUri: URI, folderName: string) => {
      const init: { queue: URI[]; results: URI[] } = { queue: [rootUri], results: [] };
      return Effect.iterate(init, {
        while: state => state.queue.length > 0,
        body: state =>
          Effect.gen(function* () {
            const [dir, ...rest] = state.queue;
            const entries = yield* fsService.readDirectoryWithTypes(dir!);
            const dirs = entries.filter(e => e.type === vscode.FileType.Directory);
            return {
              queue: [...rest, ...dirs.filter(({ uri }) => Utils.basename(uri) !== folderName).map(({ uri }) => uri)],
              results: [
                ...state.results,
                ...dirs.filter(({ uri }) => Utils.basename(uri) === folderName).map(({ uri }) => uri)
              ]
            };
          })
      }).pipe(Effect.map(state => state.results));
    };

    /** Prompt user to select output directory from available package directories, or choose a custom one. */
    const promptForOutputDir = Effect.fn('PromptService.promptForOutputDir')(function* (
      params: {
        readonly defaultUri: URI;
        readonly pickerPlaceHolder?: string;
      } & (
        | {
            /** Search all package directories for subdirectories with this name and offer them as candidates.
             * Mutually exclusive with `description`. */
            readonly folderName: string;
            readonly description?: never;
          }
        | {
            readonly folderName?: never;
            /** Label shown beside the first (default) directory entry in the picker.
             * Mutually exclusive with `folderName`. */
            readonly description?: string;
          }
      )
    ) {
      const CUSTOM_DIR_LABEL = `$(file-directory) ${nls.localize('choose_different_folder')}`;

      const workspaceUri = (yield* workspaceService.getWorkspaceInfoOrThrow()).uri;
      const wsPath = workspaceUri.path.endsWith('/') ? workspaceUri.path : `${workspaceUri.path}/`;
      const toRelativeLabel = (uri: URI) => (uri.path.startsWith(wsPath) ? uri.path.slice(wsPath.length) : uri.path);

      const candidateUris = [
        params.defaultUri,
        ...(params.folderName
          ? yield* Effect.gen(function* () {
              return yield* projectService.getSfProject().pipe(
                Effect.map(project => project.getPackageDirectories()),
                Stream.fromIterableEffect,
                Stream.mapEffect(pkg => findFoldersByName(toUri(pkg.fullPath), params.folderName!)),
                Stream.mapConcat(uris => uris),
                Stream.filter(u => !Equal.equals(HashableUri.fromUri(u), HashableUri.fromUri(params.defaultUri))),
                Stream.runCollect,
                Effect.map(Chunk.toReadonlyArray)
              );
            })
          : [])
      ];

      const items = [
        ...candidateUris.map((uri, i) => ({
          label: toRelativeLabel(uri),
          description: i === 0 ? params.description : undefined,
          uri
        })),
        { label: CUSTOM_DIR_LABEL, description: undefined, uri: undefined }
      ];

      const selected = yield* Effect.promise(() =>
        vscode.window.showQuickPick(items, {
          placeHolder: params.pickerPlaceHolder,
          matchOnDescription: true
        })
      ).pipe(Effect.flatMap(considerUndefinedAsCancellation));

      if (selected.label === CUSTOM_DIR_LABEL) {
        const folders = yield* Effect.promise(() =>
          vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: params.defaultUri,
            openLabel: nls.localize('select_folder')
          })
        );
        return yield* considerUndefinedAsCancellation(folders?.[0]);
      }

      return selected.uri!;
    });

    /** Pipeable operator: ties a vscode progress notification lifetime to an Effect. */
    const withProgress =
      (title: string) =>
      <A, E, R>(self: Effect.Effect<A, E, R>) =>
        Effect.suspend(() => {
          const { promise, resolve } = Promise.withResolvers<void>();
          void vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title, cancellable: false },
            () => promise
          );
          return self.pipe(Effect.ensuring(Effect.sync(resolve)));
        });

    return {
      /** If any of `uris` exists, prompt to overwrite; on cancel fail with {@link UserCancellationError}.
       * This is shared across metadata types (Apex, SOQL, LWC, Manifest, etc). */
      ensureMetadataOverwriteOrThrow,
      /** If `value` is undefined (or an empty trimmed string), fail with {@link UserCancellationError}.
       * Otherwise, return `value` with `undefined` removed from its type. */
      considerUndefinedAsCancellation,
      /** Prompt user to select output directory from available package directories, or choose a custom one. */
      promptForOutputDir,
      /** Pipeable operator: ties a vscode progress notification lifetime to an Effect. */
      withProgress
    };
  })
}) {}
