/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { FsServiceError, UserCancellationError } from './errors.js';
import type { ProjectError } from './projectService.js';
import type * as Arr from 'effect/Array';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import type * as vscode from 'vscode';
import type { URI } from 'vscode-uri';

export type OutputDirectoryPrompt = {
  readonly defaultUri: URI;
  readonly pickerPlaceHolder?: string;
} & (
  | { readonly folderName: string; readonly description?: never }
  | { readonly folderName?: never; readonly description?: string }
);

export class PromptService extends Context.Service<
  PromptService,
  {
    readonly ensureMetadataOverwriteOrThrow: (params: {
      readonly uris: readonly URI[];
    }) => Effect.Effect<void, UserCancellationError>;
    readonly confirmOrThrow: (params: {
      readonly message: string;
      readonly confirmLabel: string;
      readonly detail?: string;
    }) => Effect.Effect<void, UserCancellationError>;
    readonly considerUndefinedAsCancellation: <T>(value: T | undefined) => Effect.Effect<T, UserCancellationError>;
    readonly considerEmptySelectionAsCancellation: <T>(
      value: readonly T[] | undefined
    ) => Effect.Effect<Arr.NonEmptyReadonlyArray<T>, UserCancellationError>;
    readonly promptForOutputDir: (
      params: OutputDirectoryPrompt
    ) => Effect.Effect<URI, ProjectError | FsServiceError | UserCancellationError>;
    readonly withProgress: (
      title: string,
      location?: vscode.ProgressLocation
    ) => <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
    readonly withCancellableProgress: (
      title: string,
      location?: vscode.ProgressLocation
    ) => <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E | UserCancellationError, R>;
    readonly withCancellableProgressReporting: (
      title: string,
      location?: vscode.ProgressLocation
    ) => <A, E, R>(
      build: (
        progress: vscode.Progress<{ increment?: number; message?: string }>,
        token: vscode.CancellationToken
      ) => Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E | UserCancellationError, R>;
  }
>()('@salesforce/vscode-services/v2/PromptService') {}
