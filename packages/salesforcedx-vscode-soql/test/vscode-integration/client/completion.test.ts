/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { Connection } from '@salesforce/core';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { extensions, Position, Uri, workspace, commands } from 'vscode';
import {
  stubMockConnection,
  spyChannelService,
  stubFailingMockConnection
} from '../testUtilities';

let doc: vscode.TextDocument;
let soqlFileUri: Uri;
let workspacePath: string;
let editor: vscode.TextEditor;
let sandbox: sinon.SinonSandbox;
let mockConnection: Connection;

describe('Should do completion', async () => {
  beforeEach(async () => {
    workspacePath = workspace.workspaceFolders![0].uri.fsPath;
    soqlFileUri = Uri.file(
      path.join(workspacePath, `test_${generateRandomInt()}.soql`)
    );
    sandbox = sinon.createSandbox();
    mockConnection = stubMockConnection(sandbox);
  });

  afterEach(async () => {
    sandbox.restore();
    commands.executeCommand('workbench.action.closeActiveEditor');
    await workspace.fs.delete(soqlFileUri);
  });

  testCompletion('|', [
    {
      label: 'SELECT',
      kind: vscode.CompletionItemKind.Keyword
    }
  ]);

  testCompletion('SELECT id FROM |', [
    { label: 'Account', kind: vscode.CompletionItemKind.Class },
    { label: 'User', kind: vscode.CompletionItemKind.Class }
  ]);

  testCompletion('SELECT | FROM Account', [
    { label: 'Id', kind: vscode.CompletionItemKind.Field, detail: 'id' },
    {
      label: 'Name',
      kind: vscode.CompletionItemKind.Field,
      detail: 'string'
    },
    {
      label: '(SELECT ... FROM ...)',
      kind: vscode.CompletionItemKind.Snippet,
      insertText: '(SELECT $2 FROM $1)'
    }
  ]);
  testCompletion('SELECT | FROM User', [
    { label: 'Id', kind: vscode.CompletionItemKind.Field, detail: 'id' },
    {
      label: 'Name',
      kind: vscode.CompletionItemKind.Field,
      detail: 'string'
    },
    {
      label: 'AccountId',
      kind: vscode.CompletionItemKind.Field,
      detail: 'reference'
    },
    {
      label: 'Account',
      kind: vscode.CompletionItemKind.Class,
      insertText: 'Account.',
      detail: 'Ref. to Account'
    },
    {
      label: '(SELECT ... FROM ...)',
      kind: vscode.CompletionItemKind.Snippet,
      insertText: '(SELECT $2 FROM $1)'
    }
  ]);

  testCompletion('SELECT Id FROM Account WHERE |', [
    { label: 'Id', kind: vscode.CompletionItemKind.Field, detail: 'id' },
    {
      label: 'Name',
      kind: vscode.CompletionItemKind.Field,
      detail: 'string'
    }
  ]);

  const basicOperators = ['IN (', 'NOT IN (', '=', '!=', '<>'];
  const relativeOperators = ['<', '<=', '>', '>='];
  const idOperators = basicOperators;
  const stringOperators = [...basicOperators, ...relativeOperators, 'LIKE'];
  testCompletion(
    'SELECT Id FROM Account WHERE Id |',
    idOperators.map(operator => ({
      label: operator,
      kind: vscode.CompletionItemKind.Keyword
    }))
  );
  testCompletion(
    'SELECT Id FROM Account WHERE Name |',
    stringOperators.map(operator => ({
      label: operator,
      kind: vscode.CompletionItemKind.Keyword
    }))
  );

  // Account.Name is not Nillable
  testCompletion('SELECT Id FROM Account WHERE Name = |', []);

  // Account.BillingCity IS Nillable
  testCompletion('SELECT Id FROM Account WHERE BillingCity = |', [
    {
      label: 'NULL',
      kind: vscode.CompletionItemKind.Keyword
    }
  ]);
  // Account.BillingCity IS Nillable, however, some operators never accept NULL
  testCompletion('SELECT Id FROM Account WHERE BillingCity < |', []);
  testCompletion('SELECT Id FROM Account WHERE BillingCity <= |', []);
  testCompletion('SELECT Id FROM Account WHERE BillingCity > |', []);
  testCompletion('SELECT Id FROM Account WHERE BillingCity >= |', []);
  testCompletion('SELECT Id FROM Account WHERE BillingCity LIKE |', []);

  testCompletion(
    'SELECT Id FROM Account WHERE IsDeleted = |',
    ['TRUE', 'FALSE'].map(booleanValue => ({
      label: booleanValue,
      kind: vscode.CompletionItemKind.Value
    }))
  );
  testCompletion('SELECT Channel FROM QuickText WHERE Channel = |', [
    {
      label: 'NULL',
      kind: vscode.CompletionItemKind.Keyword
    },
    ...['Email', 'Portal', 'Phone'].map(booleanValue => ({
      label: booleanValue,
      kind: vscode.CompletionItemKind.Value
    }))
  ]);
  // NOTE: NULL not supported in INCLUDES/EXCLUDES list
  testCompletion('SELECT Channel FROM QuickText WHERE Channel INCLUDES(|', [
    ...['Email', 'Portal', 'Phone'].map(booleanValue => ({
      label: booleanValue,
      kind: vscode.CompletionItemKind.Value
    }))
  ]);

  testCompletion('SELECT Id FROM Account WHERE CreatedDate < |', [
    {
      label: 'YYYY-MM-DDThh:mm:ssZ',
      kind: vscode.CompletionItemKind.Snippet
    }
  ]);
  testCompletion('SELECT Id FROM Account WHERE LastActivityDate < |', [
    {
      label: 'YYYY-MM-DD',
      kind: vscode.CompletionItemKind.Snippet
    }
  ]);
});

describe('Should not do completion on connection errors', async () => {
  beforeEach(async () => {
    workspacePath = workspace.workspaceFolders![0].uri.fsPath;
    soqlFileUri = Uri.file(
      path.join(workspacePath, `test_${generateRandomInt()}.soql`)
    );
    sandbox = sinon.createSandbox();
    mockConnection = stubFailingMockConnection(sandbox);
  });

  afterEach(async () => {
    sandbox.restore();
    commands.executeCommand('workbench.action.closeActiveEditor');
    await workspace.fs.delete(soqlFileUri);
  });

  testCompletion('SELECT Id FROM |', [], {
    expectChannelMsg:
      'ERROR: We can’t retrieve ' +
      'the objects in the org. Make sure that you’re connected to an authorized org ' +
      'and have permissions to view the objects in the org.'
  });

  testCompletion('SELECT | FROM Account', [], {
    expectChannelMsg:
      'ERROR: We can’t retrieve the fields for Account. Make sure that you’re connected ' +
      'to an authorized org and have permissions to view the object and fields.'
  });
});

function testCompletion(
  soqlTextWithCursorMarker: string,
  expectedCompletionItems: vscode.CompletionItem[],
  options: {
    cursorChar?: string;
    expectChannelMsg?: string;
    only?: boolean;
    skip?: boolean;
  } = {}
) {
  const { cursorChar = '|', expectChannelMsg } = options;

  const itFn = options.skip ? xit : options.only ? it.only : it;

  itFn(soqlTextWithCursorMarker, async () => {
    const position = await prepareSOQLFileAndGetCursorPosition(
      soqlTextWithCursorMarker,
      soqlFileUri,
      cursorChar
    );

    const channelServiceSpy = spyChannelService(sandbox);

    let passed = false;
    for (let tries = 3; !passed && tries > 0; tries--) {
      try {
        const actualCompletionItems = ((await vscode.commands.executeCommand(
          'vscode.executeCompletionItemProvider',
          soqlFileUri,
          position
        )) as vscode.CompletionList).items;

        const pickMainItemKeys = (item: vscode.CompletionItem) => ({
          label: item.label,
          kind: item.kind,
          detail: item.detail
        });
        const simplifiedActualCompletionItems = actualCompletionItems.map(
          pickMainItemKeys
        );
        expectedCompletionItems.map(pickMainItemKeys).forEach(item => {
          expect(simplifiedActualCompletionItems).to.deep.include(item);
        });

        if (expectChannelMsg) {
          expect(channelServiceSpy.called).to.be.true;
          console.log(channelServiceSpy.getCalls());
          expect(channelServiceSpy.lastCall.args[0]).to.equal(expectChannelMsg);
        }

        passed = true;
      } catch (failure) {
        if (tries === 1) {
          throw failure;
        } else {
          // give it a bit of time before trying again
          channelServiceSpy.resetHistory();
          await sleep(100);
        }
      }
    }
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
  } catch (e) {
    console.error(e);
  }
}

async function prepareSOQLFileAndGetCursorPosition(
  soqlTextWithCursorMarker: string,
  fileUri: vscode.Uri,
  cursorChar: string = '|'
): Promise<vscode.Position> {
  const position = getCursorPosition(soqlTextWithCursorMarker, cursorChar);
  const soqlText = soqlTextWithCursorMarker.replace(cursorChar, '');

  const encoder = new TextEncoder();
  await workspace.fs.writeFile(fileUri, encoder.encode(soqlText));
  await activate(fileUri);
  return position;
}

function getCursorPosition(text: string, cursorChar: string = '|'): Position {
  for (const [line, lineText] of text.split('\n').entries()) {
    const column = lineText.indexOf(cursorChar);
    if (column >= 0) return new Position(line, column);
  }
  throw new Error(`Cursor ${cursorChar} not found in ${text} !`);
}

function generateRandomInt() {
  return Math.floor(Math.random() * Math.floor(Number.MAX_SAFE_INTEGER));
}
