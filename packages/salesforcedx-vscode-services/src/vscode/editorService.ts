/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as PubSub from 'effect/PubSub';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';

export class NoActiveEditorError extends Schema.TaggedError<NoActiveEditorError>()('NoActiveEditorError', {
  message: Schema.String
}) {}

export class EditorService extends Effect.Service<EditorService>()('EditorService', {
  accessors: true,
  scoped: Effect.gen(function* () {
    const editorPubSub = yield* PubSub.sliding<vscode.TextEditor | undefined>(10_000);
    const disposable = vscode.window.onDidChangeActiveTextEditor(editor => {
      Effect.runSync(PubSub.publish(editorPubSub, editor));
    });
    Effect.runSync(PubSub.publish(editorPubSub, vscode.window.activeTextEditor));
    yield* Effect.addFinalizer(() => Effect.sync(() => disposable?.dispose()));

    /** Get URI from active editor, fails with NoActiveEditorError if none */
    const getActiveEditorUri = Effect.fn('EditorService.getActiveEditorUri')(function* () {
      const editor = vscode.window.activeTextEditor;
      return editor
        ? URI.parse(editor.document.uri.toString())
        : yield* Effect.fail(new NoActiveEditorError({ message: 'No active text editor is currently open' }));
    });

    /** Get text from active editor (selection if selection=true and non-empty, else full document), fails with NoActiveEditorError if none */
    const getActiveEditorText = (selection: boolean) =>
      Effect.fn('EditorService.getActiveEditorText')(function* () {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return yield* Effect.fail(new NoActiveEditorError({ message: 'No active text editor is currently open' }));
        }
        return selection && !editor.selection.isEmpty
          ? editor.document.getText(editor.selection)
          : editor.document.getText();
      })();

    return { pubsub: editorPubSub, getActiveEditorUri, getActiveEditorText };
  })
}) {}
