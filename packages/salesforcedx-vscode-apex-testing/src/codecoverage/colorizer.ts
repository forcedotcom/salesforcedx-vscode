/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import { TextEditor, window } from 'vscode';
import { getApexTestingRuntime } from '../services/extensionProvider';
import { CodeCoverageService, type CoverageRanges } from './codeCoverageService';
import { coveredLinesDecorationType, uncoveredLinesDecorationType } from './decorations';
import { StatusBarToggle } from './statusBarToggle';

const setCoverageDecorators = (editor: TextEditor, ranges: CoverageRanges): void => {
  editor.setDecorations(coveredLinesDecorationType, ranges.coveredLines);
  editor.setDecorations(uncoveredLinesDecorationType, ranges.uncoveredLines);
};

/** Compute+store coverage for the editor's document and paint the returned ranges. */
const applyForEditor = Effect.fn('colorizer.applyForEditor')(function* (editor: TextEditor) {
  const ranges = yield* CodeCoverageService.applyForEditorHandled(editor.document);
  yield* Effect.sync(() => setCoverageDecorators(editor, ranges));
});

/**
 * Subscribe to active-editor changes via EditorService (instead of a raw window.onDidChangeActiveTextEditor
 * disposable) and repaint coverage when highlighting is enabled. Seed the current editor because the PubSub
 * only delivers changes that occur after this subscription, so the already-active editor would otherwise be
 * skipped. Fork this into the extension scope so it's torn down on deactivation.
 */
export const watchActiveEditorForCoverage = Effect.fn('colorizer.watchActiveEditorForCoverage')(function* (
  statusBar: StatusBarToggle
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const editorService = yield* api.services.EditorService;
  yield* Stream.merge(
    Stream.fromEffect(Effect.sync(() => window.activeTextEditor)),
    Stream.fromPubSub(editorService.pubsub)
  ).pipe(
    Stream.runForEach(editor =>
      editor && statusBar.isHighlightingEnabled ? applyForEditor(editor) : Effect.void
    )
  );
});

/**
 * Owns the colorizer toggle command. Editor-change repainting is handled by watchActiveEditorForCoverage;
 * this only flips the status bar and (re)paints/clears the active editor on toggle.
 */
export class CodeCoverageHandler {
  constructor(private statusBar: StatusBarToggle) {}

  public async toggleCoverage(): Promise<void> {
    const editor = window.activeTextEditor;
    if (this.statusBar.isHighlightingEnabled) {
      this.statusBar.toggle(false);
      const ranges = await getApexTestingRuntime().runPromise(CodeCoverageService.clear());
      if (editor) {
        setCoverageDecorators(editor, ranges);
      }
    } else {
      if (editor) {
        await getApexTestingRuntime().runPromise(applyForEditor(editor));
      }
      this.statusBar.toggle(true);
    }
  }
}
