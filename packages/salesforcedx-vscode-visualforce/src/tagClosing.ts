/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {
  Disposable,
  Position,
  SnippetString,
  TextDocument,
  TextDocumentContentChangeEvent,
  window,
  workspace
} from 'vscode';

export function activateTagClosing(
  tagProvider: (document: TextDocument, position: Position) => Thenable<string>,
  supportedLanguages: { [id: string]: boolean },
  configName: string
): Disposable {
  const disposables: Disposable[] = [];
  workspace.onDidChangeTextDocument(
    event => onDidChangeTextDocument(event.document, event.contentChanges),
    null,
    disposables
  );

  let isEnabled = false;
  updateEnabledState();
  window.onDidChangeActiveTextEditor(updateEnabledState, null, disposables);

  let timeout: NodeJS.Timer | undefined = void 0;

  function updateEnabledState() {
    isEnabled = false;
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }
    const document = editor.document;
    if (!supportedLanguages[document.languageId]) {
      return;
    }
    if (
      !workspace.getConfiguration(void 0, document.uri).get<boolean>(configName)
    ) {
      return;
    }
    isEnabled = true;
  }

  function onDidChangeTextDocument(
    document: TextDocument,
    changes: ReadonlyArray<TextDocumentContentChangeEvent>
  ) {
    if (!isEnabled) {
      return;
    }
    const activeDocument =
      window.activeTextEditor && window.activeTextEditor.document;
    if (document !== activeDocument || changes.length === 0) {
      return;
    }
    if (typeof timeout !== 'undefined') {
      clearTimeout(timeout);
    }
    const lastChange = changes[changes.length - 1];
    const lastCharacter = lastChange.text[lastChange.text.length - 1];
    if (
      lastChange.rangeLength > 0 ||
      (lastCharacter !== '>' && lastCharacter !== '/')
    ) {
      return;
    }
    const rangeStart = lastChange.range.start;
    const version = document.version;
    timeout = setTimeout(() => {
      const position = new Position(
        rangeStart.line,
        rangeStart.character + lastChange.text.length
      );
      tagProvider(document, position).then(text => {
        if (text && isEnabled) {
          const activeEditor = window.activeTextEditor!;
          const currentDocument = activeEditor && activeEditor.document;
          if (
            document === currentDocument &&
            currentDocument.version === version
          ) {
            const selections = activeEditor.selections;
            if (
              selections.length &&
              selections.some(s => s.active.isEqual(position))
            ) {
              activeEditor.insertSnippet(
                new SnippetString(text),
                selections.map(s => s.active)
              );
            } else {
              activeEditor.insertSnippet(new SnippetString(text), position);
            }
          }
        }
      });
      timeout = void 0;
    }, 100);
  }
  return Disposable.from(...disposables);
}
