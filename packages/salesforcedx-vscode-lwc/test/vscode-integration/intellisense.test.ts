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

describe('LWC Intellisense Test Suite', () => {
  let coreExtension: vscode.Extension<any>;
  let lwcExtension: vscode.Extension<any>;
  let lwcDir: string;

  before(async () => {
    if (
      vscode.workspace &&
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0]
    ) {
      coreExtension = vscode.extensions.getExtension(
        'salesforce.salesforcedx-vscode-core'
      ) as vscode.Extension<any>;

      lwcExtension = vscode.extensions.getExtension(
        'salesforce.salesforcedx-vscode-lwc'
      ) as vscode.Extension<any>;
    }

    lwcDir = path.join(
      vscode.workspace.workspaceFolders![0].uri.fsPath,
      'force-app',
      'main',
      'default',
      'lwc'
    );
    await coreExtension.activate();
    await lwcExtension.activate();
  });

  /**
   * Test that lwc markup intellisense includes standard lwc tags and custom lwc tags
   */
  it('LWC Markup Intellisense', async function() {
    const docUri = vscode.Uri.file(
      path.join(lwcDir, 'demoLwcComponent', 'demoLwcComponent.html')
    );
    doc = await vscode.workspace.openTextDocument(docUri);
    editor = await vscode.window.showTextDocument(doc);

    // We have to have some text or we'll just get generic completions
    const position = new vscode.Position(1, 7);
    await editor.edit(editBuilder => {
      editBuilder.insert(position, '<c-');
    });

    // NOTE: Because the completion providers always returns all possible results and then VSCode
    // does the filtering based on what is typed, we have no good way of testing what vscode is
    // actually displaying to the user based on what we typed
    await testCompletion(docUri, new vscode.Position(1, 10), {
      items: [
        // Standard components
        { label: 'lightning-button', kind: vscode.CompletionItemKind.Property },
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
   *  Test that lwc javascript import content assist includes:
   *  Standard and Custom module imports
   *  Static Resources
   *  Apex
   *
   */
  it('LWC Javascript Intellisense', async function() {
    const docUri = vscode.Uri.file(
      path.join(lwcDir, 'demoLwcComponent', 'demoLwcComponent.js')
    );
    doc = await vscode.workspace.openTextDocument(docUri);
    editor = await vscode.window.showTextDocument(doc);

    // We have to have some text or we'll just get generic completions
    const position = new vscode.Position(1, 7);
    await editor.edit(editBuilder => {
      editBuilder.insert(position, "import {} from '@sal';");
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

  it('Static resources', async function() {});

  it('Custom labels', async function() {});

  it('LWC imports', async function() {});

  it('Standard components', async function() {});

  it('Custom components', async function() {});
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
