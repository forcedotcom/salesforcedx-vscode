/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  commands,
  CompletionContext,
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  CompletionTriggerKind,
  extensions,
  Position,
  TextDocument,
  Uri,
  window,
  workspace
} from 'vscode';

import { CancellationToken, ProvideCompletionItemsSignature } from 'vscode-languageclient';
import ProtocolCompletionItem from 'vscode-languageclient/lib/common/protocolCompletionItem';
import { soqlMiddleware } from '../../../src/embeddedSoql';

const SOQL_SPECIAL_COMPLETION_ITEM_LABEL = '_SOQL_';

type JavaApexLocation = {
  startIndex: number;
  endIndex: number;
  line: number;
  column: number;
};
const createApexLSPSpecialSOQLCompletionItem = (soqlText: string, location: JavaApexLocation): CompletionItem => {
  const item = new ProtocolCompletionItem(SOQL_SPECIAL_COMPLETION_ITEM_LABEL);
  item.kind = CompletionItemKind.Snippet;
  item.detail = soqlText;
  item.data = location;
  return item;
};
const FAKE_APEX_COMPLETION_ITEM = new CompletionItem('ApexCompletionItem', CompletionItemKind.Class);
const FAKE_SOQL_COMPLETION_ITEM = new CompletionItem('SoqlCompletionItem', CompletionItemKind.Class);

describe('Test embedded SOQL middleware to forward to SOQL LSP for code-completion', () => {
  let sandbox: sinon.SinonSandbox;
  let tempDoc: Uri;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
  });

  afterEach(async () => {
    sandbox.restore();
    await commands.executeCommand('workbench.action.closeActiveEditor');
    await workspace.fs.delete(tempDoc);
  });

  describe('When outside SOQL block', () => {
    it('Should return Apex completion items unchanged', async () => {
      const executeCommandSpy = sandbox.spy(commands, 'executeCommand');
      const { doc, position } = await prepareFile('class Test { | }');
      tempDoc = doc.uri;
      const items = await invokeSoqlMiddleware(doc, position, [FAKE_APEX_COMPLETION_ITEM]);

      expect(items.length).to.equal(1);
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(executeCommandSpy.called).to.be.false;
    });
  });

  describe('When inside SOQL block', () => {
    it('Should drop Apex LSP items, invoke SOQL completion and return SOQL LSP items', async () => {
      const lines: string[] = ['class Test {', '  private Account[] account = [SELECT Id |];', '}'];
      const soqlOnlyLines: string[] = ['            ', '                               SELECT Id |  ', ' '];
      const apexCode = lines.join('\n');
      const soqlCode = soqlOnlyLines.join('\n');

      const executeCommandSpy = sandbox.stub(commands, 'executeCommand').returns([FAKE_SOQL_COMPLETION_ITEM]);

      const { doc, position } = await prepareFile(apexCode);
      tempDoc = doc.uri;

      const items = await invokeSoqlMiddleware(doc, position, [
        FAKE_APEX_COMPLETION_ITEM,
        createApexLSPSpecialSOQLCompletionItem('SELECT Id ', {
          startIndex: apexCode.indexOf('[SELECT Id'),
          endIndex: apexCode.indexOf('];'),
          line: 2,
          column: lines[1].indexOf('SELECT')
        })
      ]);

      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(executeCommandSpy.called).to.be.true;
      expect(items.length).to.equal(1);
      expect(items[0]).to.equal(FAKE_SOQL_COMPLETION_ITEM);
      const virtualDocUri = executeCommandSpy.lastCall.args[1];
      const soqlVirtualDoc = await vscode.workspace.openTextDocument(virtualDocUri);
      expect(soqlVirtualDoc.getText()).to.equal(soqlCode.replace('|', ''));
    });
  });
});

const invokeSoqlMiddleware = async (
  doc: TextDocument,
  position: Position,
  itemsReturnedByApexLsp: CompletionItem[]
): Promise<CompletionItem[]> => {
  const context: CompletionContext = {
    triggerKind: CompletionTriggerKind.Invoke,
    triggerCharacter: undefined
  };
  const token = {} as CancellationToken;

  const apexLSPCompletionFn: ProvideCompletionItemsSignature = () => {
    return itemsReturnedByApexLsp;
  };

  const finalItems: ProtocolCompletionItem[] = [];
  if (soqlMiddleware.provideCompletionItem) {
    const soqlItems = await soqlMiddleware.provideCompletionItem(doc, position, context, token, apexLSPCompletionFn);

    const items: ProtocolCompletionItem[] = Array.isArray(soqlItems)
      ? (soqlItems as ProtocolCompletionItem[])
      : ((soqlItems as CompletionList).items as ProtocolCompletionItem[]);

    finalItems.push(...items);
  }
  return finalItems;
};

const prepareFile = async (text: string): Promise<{ doc: TextDocument; position: Position }> => {
  const position = getCursorPosition(text);
  const finalText = text.replace('|', '');

  const encoder = new TextEncoder();

  const workspacePath = workspace.workspaceFolders![0].uri.fsPath;
  const fileUri = Uri.file(path.join(workspacePath, `test_embeddedSoql_${generateRandomInt()}.cls`));
  await workspace.fs.writeFile(fileUri, encoder.encode(finalText));
  return { doc: await activate(fileUri), position };
};

const getCursorPosition = (text: string, cursorChar: string = '|'): Position => {
  for (const [line, lineText] of text.split('\n').entries()) {
    const column = lineText.indexOf(cursorChar);
    if (column >= 0) return new Position(line, column);
  }
  throw new Error(`Cursor ${cursorChar} not found in ${text} !`);
};

export const activate = async (docUri: Uri): Promise<TextDocument> => {
  const ext = extensions.getExtension('salesforce.salesforcedx-vscode-apex')!;
  await ext.activate();
  try {
    const doc = await workspace.openTextDocument(docUri);
    await window.showTextDocument(doc);
    return doc;
  } catch (e) {
    console.error(e);
    throw e;
  }
};

const generateRandomInt = () => {
  return Math.floor(Math.random() * Math.floor(Number.MAX_SAFE_INTEGER));
};
