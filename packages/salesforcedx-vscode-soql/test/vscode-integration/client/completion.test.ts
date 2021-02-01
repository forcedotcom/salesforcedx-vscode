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
import { CompletionItem, CompletionItemKind } from 'vscode';
import { extensions, Position, Uri, workspace, commands } from 'vscode';
import {
  stubMockConnection,
  spyChannelService,
  stubFailingMockConnection
} from '../testUtilities';

let doc: vscode.TextDocument;
let soqlFileUri: Uri;
let workspacePath: string;
let sandbox: sinon.SinonSandbox;
let mockConnection: Connection;

const aggregateFunctionItems = [
  { label: 'AVG(...)', kind: CompletionItemKind.Function },
  { label: 'MAX(...)', kind: CompletionItemKind.Function },
  { label: 'MIN(...)', kind: CompletionItemKind.Function },
  { label: 'SUM(...)', kind: CompletionItemKind.Function },
  { label: 'COUNT(...)', kind: CompletionItemKind.Function },
  { label: 'COUNT_DISTINCT(...)', kind: CompletionItemKind.Function }
];

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
      kind: CompletionItemKind.Keyword
    },
    {
      label: 'SELECT ... FROM ...',
      kind: CompletionItemKind.Snippet,
      insertText: 'SELECT $2 FROM $1'
    }
  ]);

  testCompletion('SELECT id FROM |', [
    { label: 'Account', kind: CompletionItemKind.Class },
    { label: 'User', kind: CompletionItemKind.Class }
  ]);

  testCompletion('SELECT | FROM Account', [
    { label: 'Id', kind: CompletionItemKind.Field, detail: 'id' },
    {
      label: 'Name',
      kind: CompletionItemKind.Field,
      detail: 'string'
    },
    { label: 'Description', kind: 4, detail: 'string' },
    { label: 'CreatedDate', kind: 4, detail: 'datetime' },
    { label: 'BillingCity', kind: 4, detail: 'string' },
    { label: 'IsDeleted', kind: 4, detail: 'boolean' },
    { label: 'LastActivityDate', kind: 4, detail: 'date' },
    ...aggregateFunctionItems,
    {
      label: '(SELECT ... FROM ...)',
      kind: CompletionItemKind.Snippet,
      insertText: '(SELECT $2 FROM $1)'
    },
    { label: 'COUNT()', kind: CompletionItemKind.Keyword },
    { label: 'DISTANCE(', kind: CompletionItemKind.Keyword },
    { label: 'TYPEOF', kind: CompletionItemKind.Keyword }
  ]);
  testCompletion('SELECT | FROM User', [
    { label: 'Id', kind: CompletionItemKind.Field, detail: 'id' },
    {
      label: 'Name',
      kind: CompletionItemKind.Field,
      detail: 'string'
    },
    {
      label: 'AccountId',
      kind: CompletionItemKind.Field,
      detail: 'reference'
    },
    {
      label: 'Account',
      kind: CompletionItemKind.Class,
      insertText: 'Account.',
      detail: 'Ref. to Account'
    },
    { label: 'IsDeleted', kind: 4, detail: 'boolean' },
    ...aggregateFunctionItems,
    {
      label: '(SELECT ... FROM ...)',
      kind: CompletionItemKind.Snippet,
      insertText: '(SELECT $2 FROM $1)'
    },
    { label: 'COUNT()', kind: CompletionItemKind.Keyword },
    { label: 'DISTANCE(', kind: CompletionItemKind.Keyword },
    { label: 'TYPEOF', kind: CompletionItemKind.Keyword }
  ]);

  testCompletion('SELECT Id FROM Account WHERE |', [
    { label: 'Id', kind: CompletionItemKind.Field, detail: 'id' },
    {
      label: 'Name',
      kind: CompletionItemKind.Field,
      detail: 'string'
    },
    { label: 'Description', kind: 4, detail: 'string' },
    { label: 'CreatedDate', kind: 4, detail: 'datetime' },
    { label: 'BillingCity', kind: 4, detail: 'string' },
    { label: 'IsDeleted', kind: 4, detail: 'boolean' },
    { label: 'LastActivityDate', kind: 4, detail: 'date' },
    { label: 'NOT', kind: CompletionItemKind.Keyword },
    { label: 'DISTANCE(', kind: CompletionItemKind.Keyword }
  ]);

  const basicOperators = ['IN (', 'NOT IN (', '=', '!=', '<>'];
  const relativeOperators = ['<', '<=', '>', '>='];
  const idOperators = basicOperators;
  const stringOperators = [...basicOperators, ...relativeOperators, 'LIKE'];
  testCompletion(
    'SELECT Id FROM Account WHERE Id |',
    idOperators.map(operator => ({
      label: operator,
      kind: CompletionItemKind.Keyword
    }))
  );
  testCompletion(
    'SELECT Id FROM Account WHERE Name |',
    stringOperators.map(operator => ({
      label: operator,
      kind: CompletionItemKind.Keyword
    }))
  );

  // Account.Name is not Nillable
  testCompletion('SELECT Id FROM Account WHERE Name = |', [
    { label: 'abc123', kind: CompletionItemKind.Snippet }
  ]);

  // Account.BillingCity IS Nillable
  testCompletion('SELECT Id FROM Account WHERE BillingCity = |', [
    {
      label: 'NULL',
      kind: CompletionItemKind.Keyword
    },
    { label: 'abc123', kind: CompletionItemKind.Snippet }
  ]);
  // Account.BillingCity IS Nillable, however, some operators never accept NULL
  testCompletion('SELECT Id FROM Account WHERE BillingCity < |', [
    { label: 'abc123', kind: CompletionItemKind.Snippet }
  ]);
  testCompletion('SELECT Id FROM Account WHERE BillingCity <= |', [
    { label: 'abc123', kind: CompletionItemKind.Snippet }
  ]);
  testCompletion('SELECT Id FROM Account WHERE BillingCity > |', [
    { label: 'abc123', kind: CompletionItemKind.Snippet }
  ]);
  testCompletion('SELECT Id FROM Account WHERE BillingCity >= |', [
    { label: 'abc123', kind: CompletionItemKind.Snippet }
  ]);
  testCompletion('SELECT Id FROM Account WHERE BillingCity LIKE |', [
    { label: 'abc123', kind: CompletionItemKind.Snippet }
  ]);

  testCompletion(
    'SELECT Id FROM Account WHERE IsDeleted = |',
    ['TRUE', 'FALSE'].map(booleanValue => ({
      label: booleanValue,
      kind: CompletionItemKind.Value
    }))
  );
  testCompletion('SELECT Channel FROM QuickText WHERE Channel = |', [
    {
      label: 'NULL',
      kind: CompletionItemKind.Keyword
    },
    ...['Email', 'Portal', 'Phone'].map(booleanValue => ({
      label: booleanValue,
      kind: CompletionItemKind.Value
    }))
  ]);
  // NOTE: NULL not supported in INCLUDES/EXCLUDES list
  testCompletion('SELECT Channel FROM QuickText WHERE Channel INCLUDES(|', [
    ...['Email', 'Portal', 'Phone'].map(booleanValue => ({
      label: booleanValue,
      kind: CompletionItemKind.Value
    }))
  ]);

  testCompletion(
    'SELECT Id FROM Account WHERE CreatedDate < |',
    [
      {
        label: 'YYYY-MM-DDThh:mm:ssZ',
        kind: CompletionItemKind.Snippet
      },
      {
        label: 'YESTERDAY',
        kind: CompletionItemKind.Value
      },
      {
        label: 'LAST_90_DAYS',
        kind: CompletionItemKind.Value
      },
      {
        label: 'LAST_N_DAYS:n',
        kind: CompletionItemKind.Snippet
      }
    ],
    { allowExtraCompletionItems: true }
  );
  testCompletion(
    'SELECT Id FROM Account WHERE LastActivityDate < |',
    [
      {
        label: 'YYYY-MM-DD',
        kind: CompletionItemKind.Snippet
      },
      {
        label: 'YESTERDAY',
        kind: CompletionItemKind.Value
      },
      {
        label: 'LAST_90_DAYS',
        kind: CompletionItemKind.Value
      },
      {
        label: 'LAST_N_DAYS:n',
        kind: CompletionItemKind.Snippet
      }
    ],
    { allowExtraCompletionItems: true }
  );



  testCompletion('SELECT Id, COUNT(Name) FROM Account GROUP BY |', [
    // NOTE: CreatedDate  and Description are NOT groupable, so we DON'T them:
    { label: '★ Id', kind: CompletionItemKind.Field, detail: 'id' },
    {
      label: 'Name',
      kind: CompletionItemKind.Field,
      detail: 'string'
    },
    { label: 'BillingCity', kind: CompletionItemKind.Field, detail: 'string' },
    { label: 'IsDeleted', kind: CompletionItemKind.Field, detail: 'boolean' },
    {
      label: 'LastActivityDate',
      kind: CompletionItemKind.Field,
      detail: 'date'
    },
    { label: 'CUBE', kind: CompletionItemKind.Keyword },
    { label: 'ROLLUP', kind: CompletionItemKind.Keyword }
  ]);

  testCompletion('SELECT Id FROM Account ORDER BY |', [
    // NOTE: Description is NOT sorteable, so we DON'T expect it:
    { label: 'Id', kind: CompletionItemKind.Field, detail: 'id' },
    {
      label: 'CreatedDate',
      kind: CompletionItemKind.Field,
      detail: 'datetime'
    },
    {
      label: 'Name',
      kind: CompletionItemKind.Field,
      detail: 'string'
    },
    { label: 'BillingCity', kind: CompletionItemKind.Field, detail: 'string' },
    { label: 'IsDeleted', kind: CompletionItemKind.Field, detail: 'boolean' },
    {
      label: 'LastActivityDate',
      kind: CompletionItemKind.Field,
      detail: 'date'
    },
    { label: 'DISTANCE(', kind: CompletionItemKind.Keyword }
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

  testCompletion(
    'SELECT | FROM Account',
    [
      ...aggregateFunctionItems,
      {
        label: '(SELECT ... FROM ...)',
        kind: CompletionItemKind.Snippet,
        insertText: '(SELECT $2 FROM $1)'
      },
      { label: 'COUNT()', kind: CompletionItemKind.Keyword },
      { label: 'DISTANCE(', kind: CompletionItemKind.Keyword },
      { label: 'TYPEOF', kind: CompletionItemKind.Keyword }
    ],
    {
      expectChannelMsg:
        'ERROR: We can’t retrieve the fields for Account. Make sure that you’re connected ' +
        'to an authorized org and have permissions to view the object and fields.'
    }
  );
});

const shouldIgnoreCompletionItem = (i: CompletionItem) =>
  i.detail !== 'tabnine' && i.kind !== CompletionItemKind.Text;

function testCompletion(
  soqlTextWithCursorMarker: string,
  expectedCompletionItems: CompletionItem[],
  options: {
    cursorChar?: string;
    expectChannelMsg?: string;
    allowExtraCompletionItems?: boolean;
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

        const pickMainItemKeys = (item: CompletionItem) => ({
          label: item.label,
          kind: item.kind,
          detail: item.detail
        });
        const simplifiedActualCompletionItems = actualCompletionItems
          .filter(shouldIgnoreCompletionItem)
          .map(pickMainItemKeys);
        const simplifiedExpectedCompletionItems = expectedCompletionItems.map(
          pickMainItemKeys
        );

        simplifiedExpectedCompletionItems.forEach(item => {
          expect(simplifiedActualCompletionItems).to.deep.include(item);
        });
        if (!options.allowExtraCompletionItems) {
          simplifiedActualCompletionItems.forEach(item => {
            expect(simplifiedExpectedCompletionItems).to.deep.include(item);
          });
        }
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
    await vscode.window.showTextDocument(doc);
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
