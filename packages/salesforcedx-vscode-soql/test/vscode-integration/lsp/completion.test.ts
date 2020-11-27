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
import {
  getMockConnection,
  MockConnection,
  mockDescribeGlobalResponse,
  mockSObject
} from '../testUtilities';

const sfdxCoreExtension = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
);
const sfdxCoreExports = sfdxCoreExtension
  ? sfdxCoreExtension.exports
  : undefined;
const { workspaceContext } = sfdxCoreExports;

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
    mockConnection = getMockConnection(sandbox);
    sandbox.stub(workspaceContext, 'getConnection').returns(mockConnection);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('Completes in empty SOQL file', async () => {
    await testCompletion('|', {
      items: [{ label: 'SELECT', kind: vscode.CompletionItemKind.Keyword }]
    });
  });

  it('Completes after FROM', async () => {
    await testCompletion('SELECT id FROM |', {
      items: [
        { label: 'A', kind: vscode.CompletionItemKind.Class },
        { label: 'B', kind: vscode.CompletionItemKind.Class }
      ]
    });
  });
});

async function testCompletion(
  soqlTextWithCursorMarker: string,
  expectedCompletionList: vscode.CompletionList,
  cursorChar: string = '|'
) {
  const position = getCursorPosition(soqlTextWithCursorMarker, cursorChar);
  const soqlText = soqlTextWithCursorMarker.replace(cursorChar, '');

  const encoder = new TextEncoder();
  await workspace.fs.writeFile(soqlFileUri, encoder.encode(soqlText));

  await activate(soqlFileUri);

  const actualCompletionList = (await vscode.commands.executeCommand(
    'vscode.executeCompletionItemProvider',
    soqlFileUri,
    position
  )) as vscode.CompletionList;

  expect(actualCompletionList.items.length).greaterThan(0);
  expectedCompletionList.items.forEach((expectedItem, i) => {
    const actualItem = actualCompletionList.items[i];
    expect(actualItem.label).equals(expectedItem.label);
    expect(actualItem.kind).equals(expectedItem.kind);
  });
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function activate(docUri: vscode.Uri) {
  const ext = extensions.getExtension('salesforce.salesforcedx-vscode-soql')!;
  await ext.activate();
  try {
    doc = await vscode.workspace.openTextDocument(docUri);
    editor = await vscode.window.showTextDocument(doc);
    await sleep(2000); // Wait for server activation
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
