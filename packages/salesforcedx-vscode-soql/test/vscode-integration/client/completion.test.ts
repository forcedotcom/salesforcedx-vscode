/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { extensions, Position, Uri, workspace } from 'vscode';
import { stubMockConnection, MockConnection } from '../testUtilities';

let doc: vscode.TextDocument;
let soqlFileUri: Uri;
let workspacePath: string;
let editor: vscode.TextEditor;
let sandbox: sinon.SinonSandbox;
let mockConnection: MockConnection;

describe('Should do completion', async () => {
  beforeEach(async () => {
    workspacePath = workspace.workspaceFolders![0].uri.fsPath;
    soqlFileUri = Uri.file(path.join(workspacePath, 'test.soql'));
    sandbox = sinon.createSandbox();
    mockConnection = stubMockConnection(sandbox);
  });

  afterEach(() => {
    sandbox.restore();
  });

  testCompletion('|', [
    { label: 'SELECT', kind: vscode.CompletionItemKind.Keyword }
  ]);

  testCompletion('SELECT id FROM |', [
    { label: 'Account', kind: vscode.CompletionItemKind.Class },
    { label: 'User', kind: vscode.CompletionItemKind.Class }
  ]);

  testCompletion('SELECT | FROM Account', [
    { label: 'Id', kind: vscode.CompletionItemKind.Field },
    { label: 'Name', kind: vscode.CompletionItemKind.Field },
    {
      label: '(SELECT ... FROM ...)',
      kind: vscode.CompletionItemKind.Snippet,
      insertText: '(SELECT $2 FROM $1)'
    }
  ]);
  testCompletion('SELECT | FROM User', [
    { label: 'Id', kind: vscode.CompletionItemKind.Field },
    { label: 'Name', kind: vscode.CompletionItemKind.Field },
    { label: 'AccountId', kind: vscode.CompletionItemKind.Field },
    {
      label: 'Account (Account)',
      kind: vscode.CompletionItemKind.Class,
      insertText: 'Account.'
    },
    {
      label: '(SELECT ... FROM ...)',
      kind: vscode.CompletionItemKind.Snippet,
      insertText: '(SELECT $2 FROM $1)'
    }
  ]);
});

function testCompletion(
  soqlTextWithCursorMarker: string,
  expectedCompletionItems: vscode.CompletionItem[],
  cursorChar: string = '|'
) {
  it(soqlTextWithCursorMarker, async () => {
    const position = getCursorPosition(soqlTextWithCursorMarker, cursorChar);
    const soqlText = soqlTextWithCursorMarker.replace(cursorChar, '');

    const encoder = new TextEncoder();
    await workspace.fs.writeFile(soqlFileUri, encoder.encode(soqlText));

    await activate(soqlFileUri);

    let passed = false;
    for (let tries = 3; !passed && tries > 0; tries--) {
      try {
        const actualCompletionItems = sortItems(
          ((await vscode.commands.executeCommand(
            'vscode.executeCompletionItemProvider',
            soqlFileUri,
            position
          )) as vscode.CompletionList).items
        );

        expect(actualCompletionItems.length).gte(
          expectedCompletionItems.length
        );

        sortItems(expectedCompletionItems).forEach((expectedItem, i) => {
          const actualItem = actualCompletionItems[i];
          expect(actualItem.label).equals(expectedItem.label);
          expect(actualItem.kind).equals(expectedItem.kind);
        });
        passed = true;
      } catch (failure) {
        if (tries === 1) {
          throw failure;
        } else {
          // give it a bit of time before trying again
          await sleep(100);
        }
      }
    }
  });
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sortItems(items: vscode.CompletionItem[]): vscode.CompletionItem[] {
  items.sort((a, b) => (a.label > b.label ? 1 : b.label > a.label ? -1 : 0));
  return items;
}

export async function activate(docUri: vscode.Uri) {
  const ext = extensions.getExtension('salesforce.salesforcedx-vscode-soql')!;
  await ext.activate();
  try {
    doc = await vscode.workspace.openTextDocument(docUri);
    editor = await vscode.window.showTextDocument(doc);
  } catch (e) {
    console.error(e);
  }
}

function getCursorPosition(text: string, cursorChar: string): Position {
  for (const [line, lineText] of text.split('\n').entries()) {
    const column = lineText.indexOf(cursorChar);
    if (column >= 0) return new Position(line, column);
  }
  throw new Error(`Cursor ${cursorChar} not found in ${text} !`);
}
