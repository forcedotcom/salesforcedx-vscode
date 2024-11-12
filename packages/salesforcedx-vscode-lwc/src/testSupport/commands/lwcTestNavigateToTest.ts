/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { TestNode } from '../testExplorer/testNode';

/**
 * Select specific range in the text editor
 * @param index VS Code range
 */
const updateSelection = (index: vscode.Range | number) => {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    if (index instanceof vscode.Range) {
      editor.selection = new vscode.Selection(index.start, index.end);
      editor.revealRange(index); // Show selection
    } else {
      const line = editor.document.lineAt(index);
      const startPos = new vscode.Position(line.lineNumber, line.firstNonWhitespaceCharacterIndex);
      editor.selection = new vscode.Selection(startPos, line.range.end);
      editor.revealRange(line.range); // Show selection
    }
  }
};

/**
 * Navigate to the test position
 * @param node test explorer node
 */
export const lwcTestNavigateToTest = (node: TestNode) => {
  if (node.location) {
    vscode.window.showTextDocument(node.location.uri);
  }
  const position: vscode.Range | number = node.location!.range;
  updateSelection(position);
};
