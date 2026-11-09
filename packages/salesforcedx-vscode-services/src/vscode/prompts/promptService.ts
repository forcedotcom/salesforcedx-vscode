/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Arr from 'effect/Array';
import * as Chunk from 'effect/Chunk';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Equal from 'effect/Equal';
import * as Exit from 'effect/Exit';
import { isNotUndefined, isString } from 'effect/Predicate';
import * as Runtime from 'effect/Runtime';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { type URI, Utils } from 'vscode-uri';
import { ProjectService } from '../../core/projectService';
import { nls } from '../../messages';
import { FsService } from '../fsService';
import { HashableUri } from '../hashableUri';
import { NotificationModeService } from '../notificationModeService';
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

type ProgressTask<A, E, R> = (
  progress: vscode.Progress<{ increment?: number; message?: string }>,
  token: vscode.CancellationToken
) => Effect.Effect<A, E, R>;

type ProgressOptions = {
  readonly title: string;
  /** Whether VS Code shows a Cancel button. */
  readonly cancellable: boolean;
  /**
   * Controls how a click on VS Code's Cancel button affects `build`.
   * Defaults to `true`: PromptService interrupts `build` and fails with `UserCancellationError`.
   * Set to `false` when `build` must handle the token itself—for example, to let an in-flight server request
   * settle and preserve its outcome, or to stop between steps. In this mode the progress UI stays open until
   * `build` settles. This does not suppress real Effect fiber interruption; that still interrupts `build`.
   * Has no effect when `cancellable` is `false`, because VS Code shows no Cancel button.
   */
  readonly interruptOnCancel?: boolean;
};
type CommandProgressParams = ProgressOptions & {
  /** Resolve this extension's notification-mode location when the returned Effect runs. */
  readonly command: string;
  readonly location?: never;
};
type LocationProgressParams = ProgressOptions & {
  readonly command?: never;
  /** Use a fixed VS Code location; defaults to `Notification`. */
  readonly location?: vscode.ProgressLocation | undefined;
};
type ProgressParams = CommandProgressParams | LocationProgressParams;

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
        ).pipe(Effect.map(matches => matches.find(isNotUndefined)));
        if (!firstExistingUri) return;

        const placeholder = yield* fsService.uriToPath(firstExistingUri);

        const choice = yield* Effect.promise(() =>
          vscode.window.showWarningMessage(
            nls.localize('metadata_overwrite_confirmation', placeholder),
            { modal: true },
            nls.localize('overwrite_button')
          )
        );

        yield* Effect.succeed(choice).pipe(
          Effect.filterOrFail(
            selectedChoice => selectedChoice === nls.localize('overwrite_button'),
            () => new UserCancellationError({ message: 'User cancelled overwrite' })
          )
        );
      }
    );

    /** Show a modal warning with a single confirm button; if the user dismisses it (does not click
     * `confirmLabel`), fail with {@link UserCancellationError}. Use to gate destructive actions. */
    const confirmOrThrow = Effect.fn('PromptService.confirmOrThrow')(function* (params: {
      readonly message: string;
      readonly confirmLabel: string;
      readonly detail?: string;
    }) {
      const choice = yield* Effect.promise(() =>
        vscode.window.showWarningMessage(params.message, { modal: true, detail: params.detail }, params.confirmLabel)
      );
      yield* Effect.succeed(choice).pipe(
        Effect.filterOrFail(
          selectedChoice => selectedChoice === params.confirmLabel,
          () => new UserCancellationError({ message: 'User cancelled confirmation' })
        )
      );
    });

    /** If `value` is undefined (or an empty trimmed string), fail with {@link UserCancellationError}.
     * Otherwise, return `value` with `undefined` removed from its type. */
    const considerUndefinedAsCancellation = <T>(value: T | undefined) =>
      Effect.succeed(value).pipe(
        Effect.filterOrFail(
          (candidateValue): candidateValue is T =>
            isNotUndefined(candidateValue) && (!isString(candidateValue) || candidateValue.trim().length > 0),
          () => new UserCancellationError()
        )
      );

    /** Multi-pick sibling of {@link considerUndefinedAsCancellation}: treats `undefined` (Esc) AND an empty
     * selection array (picked nothing then accepted) as cancellation. `canPickMany` quick picks resolve to
     * `[]` on pick-nothing, which `considerUndefinedAsCancellation` would let through. */
    const considerEmptySelectionAsCancellation = <T>(value: readonly T[] | undefined) =>
      Effect.succeed(value).pipe(
        Effect.filterOrFail(
          (candidateValue): candidateValue is Arr.NonEmptyReadonlyArray<T> =>
            isNotUndefined(candidateValue) && Arr.isNonEmptyReadonlyArray(candidateValue),
          () => new UserCancellationError()
        )
      );

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
          ? yield* projectService.getSfProject().pipe(
              Effect.map(project => project.getPackageDirectories()),
              Stream.fromIterableEffect,
              Stream.mapEffect(pkg => findFoldersByName(toUri(pkg.fullPath), params.folderName!)),
              Stream.mapConcat(uris => uris),
              Stream.filter(u => !Equal.equals(HashableUri.fromUri(u), HashableUri.fromUri(params.defaultUri))),
              Stream.runCollect,
              Effect.map(Chunk.toReadonlyArray)
            )
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
        return yield* Effect.promise(() =>
          vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: params.defaultUri,
            openLabel: nls.localize('select_folder')
          })
        ).pipe(Effect.flatMap(considerEmptySelectionAsCancellation), Effect.map(Arr.headNonEmpty));
      }

      return selected.uri!;
    });

    /**
     * Run an Effect under VS Code progress. Choose either `command` to use the calling extension's notification
     * setting, or `location` for fixed placement. Command settings resolve when the returned Effect runs, not
     * while the shared PromptService layer is constructed. The build callback always receives a progress
     * reporter and cancellation token; ignore either when not needed.
     *
     * On Cancel, the default is to interrupt `build` and fail with {@link UserCancellationError}. Set
     * `interruptOnCancel: false` when `build` must handle cancellation cooperatively and settle with its real
     * outcome (for example, let a server request settle or stop between steps). The progress UI stays open until
     * `build` settles. A real Effect fiber interruption always interrupts `build`, regardless of this option.
     */
    const runWithProgressAtLocation = <A, E, R>(
      params: ProgressOptions,
      location: vscode.ProgressLocation,
      build: ProgressTask<A, E, R>
    ) =>
      Effect.gen(function* () {
        const runtime = yield* Effect.runtime<R>();
        const cancelDeferred = yield* Deferred.make<never, UserCancellationError>();
        return yield* Effect.async<A, E | UserCancellationError>((resume, signal) => {
          // Route real fiber interruption through the same cancel path so build interrupts and progress settles.
          signal.addEventListener(
            'abort',
            () =>
              void Runtime.runPromise(runtime)(
                Deferred.fail(cancelDeferred, new UserCancellationError({ message: 'User cancelled progress' }))
              )
          );
          void vscode.window.withProgress(
            { location, title: params.title, cancellable: params.cancellable },
            async (progress, token) => {
              const cancellation =
                params.interruptOnCancel === false
                  ? undefined
                  : token.onCancellationRequested(
                      () =>
                        void Runtime.runPromise(runtime)(
                          Deferred.fail(
                            cancelDeferred,
                            new UserCancellationError({ message: 'User cancelled progress' })
                          )
                        )
                    );
              const exit = await Effect.raceFirst(build(progress, token), Deferred.await(cancelDeferred)).pipe(
                Effect.exit,
                Effect.ensuring(Effect.sync(() => cancellation?.dispose())),
                Runtime.runPromise(runtime)
              );
              resume(Exit.isSuccess(exit) ? Effect.succeed(exit.value) : Effect.failCause(exit.cause));
            }
          );
        });
      });

    function withProgress(
      params: CommandProgressParams
    ): <A, E, R>(
      build: ProgressTask<A, E, R>
    ) => Effect.Effect<A, E | UserCancellationError, R | NotificationModeService>;
    function withProgress(
      params: LocationProgressParams
    ): <A, E, R>(build: ProgressTask<A, E, R>) => Effect.Effect<A, E | UserCancellationError, R>;
    function withProgress(
      params: ProgressParams
    ): <A, E, R>(
      build: ProgressTask<A, E, R>
    ) => Effect.Effect<A, E | UserCancellationError, R | NotificationModeService>;
    // Overloads keep the NotificationModeService requirement conditional on command placement.
    // eslint-disable-next-line prefer-arrow/prefer-arrow-functions -- TypeScript overloads require a function declaration.
    function withProgress(params: ProgressParams) {
      return <A, E, R>(build: ProgressTask<A, E, R>) =>
        params.command !== undefined
          ? NotificationModeService.getProgressLocation(params.command).pipe(
              // Look up command-specific settings in the caller's context, not while constructing shared PromptService.
              Effect.flatMap(location => runWithProgressAtLocation(params, location, build))
            )
          : runWithProgressAtLocation(params, params.location ?? vscode.ProgressLocation.Notification, build);
    }

    return {
      /** If any of `uris` exists, prompt to overwrite; on cancel fail with {@link UserCancellationError}.
       * This is shared across metadata types (Apex, SOQL, LWC, Manifest, etc). */
      ensureMetadataOverwriteOrThrow,
      /** Show a modal warning with a single confirm button; if the user dismisses it (does not click
       * `confirmLabel`), fail with {@link UserCancellationError}. Use to gate destructive actions. */
      confirmOrThrow,
      /** If `value` is undefined (or an empty trimmed string), fail with {@link UserCancellationError}.
       * Otherwise, return `value` with `undefined` removed from its type. */
      considerUndefinedAsCancellation,
      /** Multi-pick sibling: treats `undefined` (Esc) AND an empty selection array as {@link UserCancellationError}. */
      considerEmptySelectionAsCancellation,
      /** Prompt user to select output directory from available package directories, or choose a custom one. */
      promptForOutputDir,
      withProgress
    };
  })
}) {}
