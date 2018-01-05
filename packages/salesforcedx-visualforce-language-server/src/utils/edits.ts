/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { Position, TextDocument, TextEdit } from 'vscode-languageserver-types';

export function applyEdits(document: TextDocument, edits: TextEdit[]): string {
  let text = document.getText();
  const sortedEdits = edits.sort((a, b) => {
    const startDiff = comparePositions(a.range.start, b.range.start);
    if (startDiff === 0) {
      return comparePositions(a.range.end, b.range.end);
    }
    return startDiff;
  });
  sortedEdits.forEach(e => {
    const startOffset = document.offsetAt(e.range.start);
    const endOffset = document.offsetAt(e.range.end);
    text =
      text.substring(0, startOffset) +
      e.newText +
      text.substring(endOffset, text.length);
  });
  return text;
}

function comparePositions(p1: Position, p2: Position) {
  const diff = p2.line - p1.line;
  if (diff === 0) {
    return p2.character - p1.character;
  }
  return diff;
}
