/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { isString } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { nls } from '../../messages';
import { FsService } from '../fsService';

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
  dependencies: [FsService.Default],
  effect: Effect.gen(function* () {
    const fsService = yield* FsService;

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

    /** Prompt user to select output directory from available package directories, or choose a custom one. */
    const promptForOutputDir = Effect.fn('PromptService.promptForOutputDir')(function* (params: {
      readonly defaultUri: URI;
      readonly description?: string;
      readonly pickerPlaceHolder?: string;
    }) {
      const CUSTOM_DIR_LABEL = `$(file-directory) ${nls.localize('choose_different_folder')}`;

      const selected = yield* Effect.promise(() =>
        vscode.window.showQuickPick(
          [
            { label: params.defaultUri.fsPath, description: params.description, uri: params.defaultUri },
            { label: CUSTOM_DIR_LABEL, description: undefined, uri: undefined }
          ],
          {
            placeHolder: params.pickerPlaceHolder,
            matchOnDescription: true
          }
        )
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

    return {
      ensureMetadataOverwriteOrThrow,
      ensureValueOrThrow: considerUndefinedAsCancellation,
      promptForOutputDir
    };
  })
}) {}
