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

/** Update VS Code context variable when the active editor changes */
export const watchPackageDirectoriesContext = () =>
  Effect.gen(function* () {
    const [editorService, projectService] = yield* Effect.all([EditorService, ProjectService]);

    yield* Stream.merge(
      Stream.fromEffect(
        editorService.getActiveEditorUri().pipe(Effect.catchTag('NoActiveEditorError', () => Effect.succeed(undefined)))
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
