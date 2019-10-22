import * as vscode from 'vscode';
import { TestNode } from '../testExplorer/testNode';

function updateSelection(index: vscode.Range | number) {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    if (index instanceof vscode.Range) {
      editor.selection = new vscode.Selection(index.start, index.end);
      editor.revealRange(index); // Show selection
    } else {
      const line = editor.document.lineAt(index);
      const startPos = new vscode.Position(
        line.lineNumber,
        line.firstNonWhitespaceCharacterIndex
      );
      editor.selection = new vscode.Selection(startPos, line.range.end);
      editor.revealRange(line.range); // Show selection
    }
  }
}
export function forceLwcTestNavigateToTest(node: TestNode) {
  if (node.location) {
    vscode.window.showTextDocument(node.location.uri);
  }
  const position: vscode.Range | number = node.location!.range;
  updateSelection(position);
}
