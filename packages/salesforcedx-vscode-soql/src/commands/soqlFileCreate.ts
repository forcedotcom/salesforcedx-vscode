/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { BUILDER_VIEW_TYPE, OPEN_WITH_COMMAND } from '../constants';
import { nls } from '../messages';

export const soqlOpenNew = Effect.fn('soql_builder_open_new')(function* () {
  if (vscode.workspace) {
    const fileName = 'untitled.soql';
    const newUri = URI.file(fileName).with({
      scheme: 'untitled',
      path: fileName
    });

    const existingDoc = vscode.workspace.textDocuments.find(
      doc => doc.uri.toString() === newUri.toString()
    );

    const hasUnsavedContent =
      existingDoc !== undefined && (existingDoc.isDirty || existingDoc.getText().trim().length > 0);

    if (hasUnsavedContent) {
      const saveLabel = nls.localize('soql_open_new_unsaved_save');
      const dontSaveLabel = nls.localize('soql_open_new_unsaved_dont_save');
      const answer = yield* Effect.promise(() =>
        vscode.window.showWarningMessage(
          nls.localize('soql_open_new_unsaved_warning'),
          { modal: true, detail: nls.localize('soql_open_new_unsaved_detail') },
          saveLabel,
          dontSaveLabel
        )
      );

      if (answer === saveLabel) {
        const savedUri = yield* Effect.promise(() => vscode.workspace.save(existingDoc.uri));
        if (!savedUri) {
          return;
        }
      } else if (answer === dontSaveLabel) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(existingDoc.uri, new vscode.Range(0, 0, existingDoc.lineCount, 0), '');
        yield* Effect.promise(() => vscode.workspace.applyEdit(edit));
      } else {
        return;
      }
    }

    yield* Effect.promise(() => vscode.commands.executeCommand(OPEN_WITH_COMMAND, newUri, BUILDER_VIEW_TYPE));
  }
});
