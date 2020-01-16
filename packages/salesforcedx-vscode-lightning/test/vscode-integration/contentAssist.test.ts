/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { assert, expect } from 'chai';
import * as path from 'path';
import * as vscode from 'vscode';

let doc: vscode.TextDocument;
let editor: vscode.TextEditor;

describe('Content Assist Tests', () => {
  let coreExtension: vscode.Extension<any>;
  let auraExtension: vscode.Extension<any>;

  before(async () => {
    // Before each test we need to:
    // 1. Activate both extensions
    if (
      vscode.workspace &&
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0]
    ) {
      coreExtension = vscode.extensions.getExtension(
        'salesforce.salesforcedx-vscode-core'
      ) as vscode.Extension<any>;

      auraExtension = vscode.extensions.getExtension(
        'salesforce.salesforcedx-vscode-lightning'
      ) as vscode.Extension<any>;
    }
  });

  it('Keystrokes should trigger Javascript auto-complete for static resources', async function() {
    // Activate our extensions
    // tslint:disable-next-line:no-invalid-this
    this.timeout(10000);
    await coreExtension.activate();
    await auraExtension.activate();
    try {
      // TODO needs to be a file in SFDX workspace
      const docUri = getDocUri('completion.txt');
      doc = await vscode.workspace.openTextDocument(docUri);
      editor = await vscode.window.showTextDocument(doc);
      await sleep(2000); // Wait for server activation

      // Test completion
      await testCompletion(docUri, new vscode.Position(0, 0), {
        items: [
          { label: 'JavaScript', kind: vscode.CompletionItemKind.Text },
          { label: 'TypeScript', kind: vscode.CompletionItemKind.Text }
        ]
      });
    } catch (e) {
      assert(false, 'Exception occurred');
      console.error(e);
    }
  });
});

// ------------- Utility Functions ----------------- //

/**
 *  Test code completion
 *
 * @param docUri
 * @param position
 * @param expectedCompletionList
 */
async function testCompletion(
  docUri: vscode.Uri,
  position: vscode.Position,
  expectedCompletionList: vscode.CompletionList
) {
  // Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
  const actualCompletionList = (await vscode.commands.executeCommand(
    'vscode.executeCompletionItemProvider',
    docUri,
    position
  )) as vscode.CompletionList;

  assert.equal(
    actualCompletionList.items.length,
    expectedCompletionList.items.length
  );
  expectedCompletionList.items.forEach((expectedItem, i) => {
    const actualItem = actualCompletionList.items[i];
    assert.equal(actualItem.label, expectedItem.label);
    assert.equal(actualItem.kind, expectedItem.kind);
  });
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const getDocPath = (p: string) => {
  return path.resolve(__dirname, '../../testFixture', p);
};

const getDocUri = (p: string) => {
  return vscode.Uri.file(getDocPath(p));
};

async function setTestContent(content: string): Promise<boolean> {
  const all = new vscode.Range(
    doc.positionAt(0),
    doc.positionAt(doc.getText().length)
  );
  return editor.edit(eb => eb.replace(all, content));
}
