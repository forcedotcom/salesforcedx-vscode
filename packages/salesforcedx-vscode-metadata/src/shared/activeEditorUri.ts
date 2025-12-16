/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';

class NoActiveEditorError {
  public readonly _tag = 'NoActiveEditorError';
}

/** Get URI from active editor, fails with NoActiveEditorError if none */
export const getActiveEditorUri = Effect.gen(function* () {
  const editor = vscode.window.activeTextEditor;
  return editor ? URI.parse(editor.document.uri.toString()) : yield* Effect.fail(new NoActiveEditorError());
});
