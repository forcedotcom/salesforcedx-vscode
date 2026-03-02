/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { ProjectService } from '../core/projectService';
import { EditorService } from './editorService';

const setInPackageDirectoriesContext = (value: boolean) =>
  Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:in_package_directories', value));

const setApexTestContext = (value: boolean) =>
  Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:current_file_is_apex_test', value));

const IS_TEST_REG_EXP = /@isTest/i;

const isApexTestFile = (editor: vscode.TextEditor | undefined): boolean =>
  editor?.document.uri.fsPath.endsWith('.cls')
    ? IS_TEST_REG_EXP.test(editor.document.getText())
    : false;

/** Update VS Code context variable when the active editor changes */
export const watchPackageDirectoriesContext = () =>
  Effect.gen(function* () {
    const [editorService, projectService] = yield* Effect.all([EditorService, ProjectService]);

    yield* Stream.merge(
      Stream.fromEffect(
        editorService.getActiveEditorUri().pipe(Effect.catchTag('NoActiveEditorError', () => Effect.void))
      ),
      Stream.fromPubSub(editorService.pubsub).pipe(Stream.map(editor => editor?.document.uri))
    ).pipe(
      Stream.debounce(Duration.millis(50)),
      Stream.changes,
      Stream.runForEach(uri =>
        uri
          ? projectService.isInPackageDirectories(uri).pipe(
              Effect.flatMap(setInPackageDirectoriesContext),
              Effect.catchAll(() => setInPackageDirectoriesContext(false))
            )
          : setInPackageDirectoriesContext(false)
      )
    );
  });

/** Update VS Code context when the active editor is an Apex test file (.cls with @isTest) */
export const watchApexTestContext = () =>
  Effect.gen(function* () {
    const editorService = yield* EditorService;
    yield* Stream.merge(
      Stream.fromEffect(Effect.sync(() => isApexTestFile(vscode.window.activeTextEditor))),
      Stream.fromPubSub(editorService.pubsub).pipe(Stream.map(isApexTestFile))
    ).pipe(
      Stream.debounce(Duration.millis(50)),
      Stream.changes,
      Stream.runForEach(setApexTestContext)
    );
  });
