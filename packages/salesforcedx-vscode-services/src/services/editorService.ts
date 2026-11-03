/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EditorService, NoActiveEditorError } from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as PubSub from 'effect/PubSub';
import * as vscode from 'vscode';

export const EditorServiceLayer = Layer.effect(
  EditorService,
  Effect.gen(function* () {
    const pubsub = yield* Effect.acquireRelease(PubSub.sliding<vscode.TextEditor | undefined>(10_000), PubSub.shutdown);
    const context = yield* Effect.context<never>();
    yield* Effect.acquireRelease(
      Effect.sync(() =>
        vscode.window.onDidChangeActiveTextEditor(editor => {
          if (PubSub.isShutdownUnsafe(pubsub)) return;
          // Sliding publication is synchronous; later subscribers must not receive this event.
          Effect.runSyncWith(context)(PubSub.publish(pubsub, editor));
        })
      ),
      listener =>
        Effect.sync(() => {
          listener.dispose();
        })
    );
    yield* PubSub.publish(pubsub, vscode.window.activeTextEditor);

    const getActiveEditorUri = Effect.fn('EditorService.getActiveEditorUri')(function* () {
      const editor = vscode.window.activeTextEditor;
      return editor
        ? editor.document.uri
        : yield* new NoActiveEditorError({ message: 'No active text editor is currently open' });
    });
    const getActiveEditorText = Effect.fn('EditorService.getActiveEditorText')(function* (selection: boolean) {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return yield* new NoActiveEditorError({ message: 'No active text editor is currently open' });
      return selection && !editor.selection.isEmpty
        ? editor.document.getText(editor.selection)
        : editor.document.getText();
    });
    const getActiveEditorContext = Effect.fn('EditorService.getActiveEditorContext')(function* (selection: boolean) {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return yield* new NoActiveEditorError({ message: 'No active text editor is currently open' });
      const useSelection = selection && !editor.selection.isEmpty;
      return {
        text: useSelection ? editor.document.getText(editor.selection) : editor.document.getText(),
        documentUri: editor.document.uri,
        selectionStart: selection
          ? { line: editor.selection.start.line, character: editor.selection.start.character }
          : undefined,
        selectionRange: useSelection
          ? { startLine: editor.selection.start.line, startCharacter: editor.selection.start.character }
          : undefined
      };
    });
    return EditorService.of({ pubsub, getActiveEditorUri, getActiveEditorText, getActiveEditorContext });
  })
);
