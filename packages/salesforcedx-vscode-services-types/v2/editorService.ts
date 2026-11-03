/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { NoActiveEditorError } from './errors.js';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import type * as PubSub from 'effect/PubSub';
import type * as vscode from 'vscode';
import type { URI } from 'vscode-uri';

export type ActiveEditorContext = {
  readonly text: string;
  readonly documentUri: URI;
  readonly selectionStart: { readonly line: number; readonly character: number } | undefined;
  readonly selectionRange: { readonly startLine: number; readonly startCharacter: number } | undefined;
};

export class EditorService extends Context.Service<
  EditorService,
  {
    readonly pubsub: PubSub.PubSub<vscode.TextEditor | undefined>;
    readonly getActiveEditorUri: () => Effect.Effect<URI, NoActiveEditorError>;
    readonly getActiveEditorText: (selection: boolean) => Effect.Effect<string, NoActiveEditorError>;
    readonly getActiveEditorContext: (selection: boolean) => Effect.Effect<ActiveEditorContext, NoActiveEditorError>;
  }
>()('@salesforce/vscode-services/v2/EditorService') {}
