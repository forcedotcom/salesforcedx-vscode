/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type Disposable, TextEditor, window } from 'vscode';
import { getApexTestingRuntime } from '../services/extensionProvider';
import { CodeCoverageService, type CoverageRanges } from './codeCoverageService';
import { coveredLinesDecorationType, uncoveredLinesDecorationType } from './decorations';
import { StatusBarToggle } from './statusBarToggle';

const setCoverageDecorators = (editor: TextEditor, ranges: CoverageRanges): void => {
  editor.setDecorations(coveredLinesDecorationType, ranges.coveredLines);
  editor.setDecorations(uncoveredLinesDecorationType, ranges.uncoveredLines);
};

/**
 * Disposable vscode edge glue: subscribes to editor changes and the toggle command, delegates all
 * coverage computation/state to CodeCoverageService, and applies the returned ranges as decorations.
 */
export class CodeCoverageHandler implements Disposable {
  private readonly editorChangeSub: Disposable;

  constructor(private statusBar: StatusBarToggle) {
    this.editorChangeSub = window.onDidChangeActiveTextEditor(editor => this.onDidChangeActiveTextEditor(editor), this);
    void this.onDidChangeActiveTextEditor(window.activeTextEditor);
  }

  public async onDidChangeActiveTextEditor(editor?: TextEditor) {
    if (editor && this.statusBar.isHighlightingEnabled) {
      const ranges = await getApexTestingRuntime().runPromise(
        CodeCoverageService.applyForEditorHandled(editor.document)
      );
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
        const ranges = await getApexTestingRuntime().runPromise(
          CodeCoverageService.applyForEditorHandled(editor.document)
        );
        setCoverageDecorators(editor, ranges);
      }
      this.statusBar.toggle(true);
    }
  }

  public dispose(): void {
    this.editorChangeSub.dispose();
  }
}
