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

describe('Aura Intellisense Test Suite', () => {
  let coreExtension: vscode.Extension<any>;
  let auraExtension: vscode.Extension<any>;
  let auraDir: string;

  before(async () => {
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

    auraDir = path.join(
      vscode.workspace.workspaceFolders![0].uri.fsPath,
      'force-app',
      'main',
      'default',
      'aura'
    );

    await coreExtension.activate();
    await auraExtension.activate();
  });

  /**
   * Test that aura markup intellisense contains aura, lightning, custom aura, custom lwc tags
   */
  it('Aura markup intellisense', async function() {
    const docUri = vscode.Uri.file(
      path.join(auraDir, 'DemoComponent', 'DemoComponent.cmp')
    );
    doc = await vscode.workspace.openTextDocument(docUri);
    editor = await vscode.window.showTextDocument(doc);
    // await sleep(2000); // Wait for server activation

    // We have to have some text or we'll just get generic completions
    const position = new vscode.Position(1, 7);
    await editor.edit(editBuilder => {
      editBuilder.insert(position, '<c:');
    });

    // NOTE: Because the completion providers always returns all possible results and then VSCode
    // does the filtering based on what is typed, we have no good way of testing what vscode is
    // actually displaying to the user based on what we typed
    await testCompletion(docUri, new vscode.Position(1, 10), {
      items: [
        // Aura system attributes
        { label: 'aura:attribute', kind: vscode.CompletionItemKind.Property },
        // Standard components
        { label: 'lightning:button', kind: vscode.CompletionItemKind.Property },
        // Custom Aura
        { label: 'c:DemoApp', kind: vscode.CompletionItemKind.Property },
        // Custom LWC
        {
          label: 'c:demoLwcComponent',
          kind: vscode.CompletionItemKind.Property
        }
      ]
    });
  });

  /**
   * Test aura javascript completions
   */
  it('Aura javascript intellisense', async function() {
    const docUri = vscode.Uri.file(
      path.join(auraDir, 'DemoComponent', 'DemoComponentController.js')
    );
    doc = await vscode.workspace.openTextDocument(docUri);
    editor = await vscode.window.showTextDocument(doc);

    // We have to have some text or we'll just get generic completions
    const position = new vscode.Position(1, 7);
    await editor.edit(editBuilder => {
      editBuilder.insert(position, '<c:');
    });

    // NOTE: Because the completion providers always returns all possible results and then VSCode
    // does the filtering based on what is typed, we have no good way of testing what vscode is
    // actually displaying to the user based on what we typed
    await testCompletion(docUri, new vscode.Position(1, 10), {
      items: [
        // Aura system attributes
        { label: 'aura:attribute', kind: vscode.CompletionItemKind.Property },
        // Standard components
        { label: 'lightning:button', kind: vscode.CompletionItemKind.Property },
        // Custom Aura
        { label: 'c:DemoApp', kind: vscode.CompletionItemKind.Property },
        // Custom LWC
        {
          label: 'c:demoLwcComponent',
          kind: vscode.CompletionItemKind.Property
        }
      ]
    });
  });
});

async function testCompletion(
  docUri: vscode.Uri,
  position: vscode.Position,
  expectedCompletionList: vscode.CompletionList
) {
  // Simulate triggering a completion
  const actualCompletionList = (await vscode.commands.executeCommand(
    'vscode.executeCompletionItemProvider',
    docUri,
    position
  )) as vscode.CompletionList;

  expectedCompletionList.items.forEach(expectedItem => {
    const actualItem = actualCompletionList.items.find(
      obj => obj.label === expectedItem.label
    );
    assert.isNotNull(
      actualItem,
      "Couldn't find expected completion item: " + expectedItem.label
    );
    assert.equal(actualItem!.label, expectedItem.label);
    assert.equal(actualItem!.kind, expectedItem.kind);
    assert.isNotNull(actualItem!.documentation);
  });
}
