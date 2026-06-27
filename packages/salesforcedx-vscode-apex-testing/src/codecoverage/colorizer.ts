/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { Disposable, TextEditor, window } from 'vscode';
import { getApexTestingRuntime } from '../services/extensionProvider';
import {
  CodeCoverageService,
  type CoverageRanges,
  NoCoverageForFileError,
  NoCoverageOnProjectError,
  OutOfSyncCoverageError,
  StaleResultsError
} from './codeCoverageService';
import { coveredLinesDecorationType, uncoveredLinesDecorationType } from './decorations';
import { StatusBarToggle } from './statusBarToggle';

const setCoverageDecorators = (editor: TextEditor, ranges: CoverageRanges): void => {
  editor.setDecorations(coveredLinesDecorationType, ranges.coveredLines);
  editor.setDecorations(uncoveredLinesDecorationType, ranges.uncoveredLines);
};

/** Compute+store coverage for the editor, mapping every coverage failure to channel/warning handling. */
const applyForEditorCommand = Effect.fn('CodeCoverageHandler.applyForEditor')(function* (editor: TextEditor) {
  return yield* CodeCoverageService.applyForEditor(editor.document).pipe(
    // Enumerate tags (not catchAll) so a new failure type forces a compile decision.
    Effect.catchTags({
      NoCoverageOnProjectError: (e: NoCoverageOnProjectError) => CodeCoverageService.handleCoverageException(e),
      StaleResultsError: (e: StaleResultsError) => CodeCoverageService.handleCoverageException(e),
      NoCoverageForFileError: (e: NoCoverageForFileError) => CodeCoverageService.handleCoverageException(e),
      OutOfSyncCoverageError: (e: OutOfSyncCoverageError) => CodeCoverageService.handleCoverageException(e)
    }),
    // handleCoverageException returns void; the editor keeps whatever the service stored (empty on failure).
    Effect.flatMap(() => CodeCoverageService.getRanges())
  );
});

/**
 * Disposable vscode edge glue: subscribes to editor changes and the toggle command, delegates all
 * coverage computation/state to CodeCoverageService, and applies the returned ranges as decorations.
 */
export class CodeCoverageHandler implements Disposable {
  private readonly editorChangeSub: Disposable;

  constructor(private statusBar: StatusBarToggle) {
    this.editorChangeSub = window.onDidChangeActiveTextEditor(
      async editor => await this.onDidChangeActiveTextEditor(editor),
      this
    );
    void this.onDidChangeActiveTextEditor(window.activeTextEditor);
  }

  public async onDidChangeActiveTextEditor(editor?: TextEditor) {
    if (editor && this.statusBar.isHighlightingEnabled) {
      const ranges = await getApexTestingRuntime().runPromise(applyForEditorCommand(editor));
      setCoverageDecorators(editor, ranges);
    }
  }

  public async toggleCoverage() {
    const editor = window.activeTextEditor;
    if (this.statusBar.isHighlightingEnabled) {
      this.statusBar.toggle(false);
      const ranges = await getApexTestingRuntime().runPromise(CodeCoverageService.clear());
      if (editor) {
        setCoverageDecorators(editor, ranges);
      }
    } else {
      if (editor?.document) {
        const ranges = await getApexTestingRuntime().runPromise(applyForEditorCommand(editor));
        setCoverageDecorators(editor, ranges);
      }
      this.statusBar.toggle(true);
    }
  }

  public dispose(): void {
    this.editorChangeSub.dispose();
  }
}
