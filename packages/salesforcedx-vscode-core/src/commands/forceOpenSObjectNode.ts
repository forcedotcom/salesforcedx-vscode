import * as vscode from 'vscode';

import { SObjectNode } from '../ui';

export function forceOpenSObjectNode(node: SObjectNode) {
  vscode.workspace.openTextDocument(node.resource).then(document => {
    vscode.window.showTextDocument(document);
  });
}
