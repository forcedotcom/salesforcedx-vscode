import * as vscode from 'vscode';

import { SObjectNode } from '../sObjectExplorer';

export function openSObjectNodeCommand(node: SObjectNode) {
  vscode.workspace.openTextDocument(node.resource).then(document => {
    vscode.window.showTextDocument(document);
  });
}
