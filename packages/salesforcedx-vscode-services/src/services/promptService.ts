/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  FsService,
  HashableUri,
  ProjectService,
  PromptService,
  UserCancellationError,
  WorkspaceService,
  type OutputDirectoryPrompt
} from '@salesforce/vscode-services/v2';
import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import * as Equal from 'effect/Equal';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import { isNotUndefined, isString } from 'effect/Predicate';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { type URI, Utils } from 'vscode-uri';
import { PromptMessages } from './promptMessages.js';
import { withCancellableProgress, withCancellableProgressReporting, withProgress } from './promptProgress.js';
import { toUri } from './uriUtils.js';

export const PromptServiceLayer = Layer.effect(
  PromptService,
  Effect.gen(function* () {
    const fs = yield* FsService;
    const project = yield* ProjectService;
    const workspace = yield* WorkspaceService;
    const messages = yield* PromptMessages;

    const considerUndefinedAsCancellation = <T>(value: T | undefined) =>
      Effect.succeed(value).pipe(
        Effect.filterOrFail(
          (candidate): candidate is T =>
            isNotUndefined(candidate) && (!isString(candidate) || candidate.trim().length > 0),
          () => new UserCancellationError({ message: 'User cancelled' })
        )
      );
    const considerEmptySelectionAsCancellation = <T>(value: readonly T[] | undefined) =>
      Effect.succeed(value).pipe(
        Effect.filterOrFail(
          (candidate): candidate is Arr.NonEmptyReadonlyArray<T> =>
            isNotUndefined(candidate) && Arr.isReadonlyArrayNonEmpty(candidate),
          () => new UserCancellationError({ message: 'User cancelled' })
        )
      );
    const ensureMetadataOverwriteOrThrow = Effect.fn('PromptService.ensureMetadataOverwriteOrThrow')(
      function* (params: { readonly uris: readonly URI[] }) {
        const existing = yield* Effect.forEach(
          params.uris,
          uri => fs.fileOrFolderExists(uri).pipe(Effect.map(exists => (exists ? uri : undefined))),
          { concurrency: 'unbounded' }
        ).pipe(Effect.map(uris => uris.find(isNotUndefined)));
        if (!existing) return;
        const path = yield* fs.uriToPath(existing);
        const choice = yield* Effect.promise(() =>
          vscode.window.showWarningMessage(
            messages.overwriteConfirmation(path),
            { modal: true },
            messages.overwriteButton
          )
        );
        yield* Effect.succeed(choice).pipe(
          Effect.filterOrFail(
            selected => selected === messages.overwriteButton,
            () => new UserCancellationError({ message: 'User cancelled overwrite' })
          )
        );
      }
    );
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
          selected => selected === params.confirmLabel,
          () => new UserCancellationError({ message: 'User cancelled confirmation' })
        )
      );
    });
    /** Search package subdirectories breadth-first; preserve native filesystem failures. */
    const findFoldersByName = (root: URI, name: string) =>
      Stream.paginate([root], queue =>
        fs.readDirectoryWithTypes(queue[0]!).pipe(
          Effect.map(entries => {
            const children = entries.filter(entry => entry.type === vscode.FileType.Directory);
            const next = [
              ...queue.slice(1),
              ...children.filter(({ uri }) => Utils.basename(uri) !== name).map(({ uri }) => uri)
            ];
            return [
              children.filter(({ uri }) => Utils.basename(uri) === name).map(({ uri }) => uri),
              next.length > 0 ? Option.some(next) : Option.none()
            ] as const;
          })
        )
      ).pipe(Stream.runCollect);
    const promptForOutputDir = Effect.fn('PromptService.promptForOutputDir')(function* (params: OutputDirectoryPrompt) {
      const customLabel = `$(file-directory) ${messages.chooseDifferentFolder}`;
      const workspaceUri = (yield* workspace.getWorkspaceInfoOrThrow()).uri;
      const prefix = workspaceUri.path.endsWith('/') ? workspaceUri.path : `${workspaceUri.path}/`;
      const candidates = [
        params.defaultUri,
        ...(params.folderName
          ? yield* project.getSfProject().pipe(
              Effect.map(value => value.getPackageDirectories()),
              Stream.fromIterableEffect,
              Stream.mapEffect(pkg => findFoldersByName(toUri(pkg.fullPath), params.folderName!)),
              Stream.flatMap(uris => Stream.fromIterable(uris)),
              Stream.filter(uri => !Equal.equals(HashableUri.fromUri(uri), HashableUri.fromUri(params.defaultUri))),
              Stream.runCollect
            )
          : [])
      ];
      const selected = yield* Effect.promise(() =>
        vscode.window.showQuickPick(
          [
            ...candidates.map((uri, index) => ({
              label: uri.path.startsWith(prefix) ? uri.path.slice(prefix.length) : uri.path,
              description: index === 0 ? params.description : undefined,
              uri
            })),
            { label: customLabel, description: undefined, uri: undefined }
          ],
          { placeHolder: params.pickerPlaceHolder, matchOnDescription: true }
        )
      ).pipe(Effect.flatMap(considerUndefinedAsCancellation));
      if (selected.label === customLabel) {
        const directories = yield* Effect.promise(() =>
          vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: params.defaultUri,
            openLabel: messages.selectFolder
          })
        );
        return yield* considerUndefinedAsCancellation(directories?.[0]);
      }
      return selected.uri!;
    });
    return PromptService.of({
      ensureMetadataOverwriteOrThrow,
      confirmOrThrow,
      considerUndefinedAsCancellation,
      considerEmptySelectionAsCancellation,
      promptForOutputDir,
      withProgress,
      withCancellableProgress,
      withCancellableProgressReporting
    });
  })
);
