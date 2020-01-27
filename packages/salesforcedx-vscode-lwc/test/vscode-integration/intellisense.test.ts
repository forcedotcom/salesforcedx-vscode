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

describe('LWC Intellisense Test Suite', function() {
  let coreExtension: vscode.Extension<any>;
  let lwcExtension: vscode.Extension<any>;
  let lwcDir: string;

  before(async function() {
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

  afterEach(async function() {
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  /**
   * Test that lwc markup intellisense includes standard lwc tags and custom lwc tags
   */
  it('LWC Markup Intellisense', async function() {
    const docUri = vscode.Uri.file(path.join(lwcDir, 'hello', 'hello.html'));
    doc = await vscode.workspace.openTextDocument(docUri);
    editor = await vscode.window.showTextDocument(doc);

    // We have to have some text or we'll just get generic completions
    const text = '<c-';
    const startPosition = new vscode.Position(7, 0);
    const endPosition = new vscode.Position(
      startPosition.line,
      startPosition.character + text.length
    );
    const rangeReplace = new vscode.Range(startPosition, endPosition);
    await editor.edit(editBuilder => {
      editBuilder.replace(rangeReplace, text);
    });

    try {
      await testCompletion(docUri, endPosition, {
        items: [
          {
            label: 'lightning-accordion',
            kind: vscode.CompletionItemKind.Property
          },
          { label: 'c-hello-binding', kind: vscode.CompletionItemKind.Property }
        ]
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   *  Test lwc javascript import content assist
   */
  it('LWC JS Import Intellisense', async function() {
    const docUri = vscode.Uri.file(path.join(lwcDir, 'hello', 'hello.js'));
    doc = await vscode.workspace.openTextDocument(docUri);
    editor = await vscode.window.showTextDocument(doc);

    // We have to have some text or we'll just get generic completions
    const text = "import {} from '@sales";
    const startPosition = new vscode.Position(1, 0);
    const endPosition = new vscode.Position(
      startPosition.line,
      startPosition.character + text.length
    );
    const rangeReplace = new vscode.Range(startPosition, endPosition);
    await editor.edit(editBuilder => {
      editBuilder.replace(rangeReplace, text);
    });

    try {
      await testCompletion(docUri, endPosition, {
        items: [
          {
            label: 'c/hellobinding',
            kind: vscode.CompletionItemKind.Function
          },
          {
            label: 'lightning/uiListApi',
            kind: vscode.CompletionItemKind.Function
          },
          {
            label: 'lightning/uiRecordApi',
            kind: vscode.CompletionItemKind.Function
          },
          {
            label: '@salesforce/apex',
            kind: vscode.CompletionItemKind.Function
          },
          {
            label: '@salesforce/apex/AccountController.getAccountList',
            kind: vscode.CompletionItemKind.Function
          },
          {
            label: '@salesforce/apex/ContactController.findContacts',
            kind: vscode.CompletionItemKind.Function
          },
          {
            label: '@salesforce/contentAssetUrl/Cookpatternv1',
            kind: vscode.CompletionItemKind.Function
          },
          {
            label: '@salesforce/resourceUrl/d3',
            kind: vscode.CompletionItemKind.Function
          },
          {
            label: '@salesforce/resourceUrl/trailhead_logo',
            kind: vscode.CompletionItemKind.Function
          },
          {
            label: '@salesforce/schema',
            kind: vscode.CompletionItemKind.Function
          },
          {
            label: '@salesforce/user/Id',
            kind: vscode.CompletionItemKind.Function
          }
        ]
      });
    } catch (error) {
      throw error;
    }
  });
});

// NOTE: Because the completion providers always returns all possible results and then VSCode
// does the filtering based on what is typed, we have no good way of testing what vscode is
// actually displaying to the user based on what we typed
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

  expectedCompletionList.items.forEach(function(expectedItem) {
    const actualItem = actualCompletionList.items.find(function(obj) {
      if (obj.label) {
        return obj.label === expectedItem.label;
      }
      return false;
    });

    assert.isDefined(
      actualItem,
      "Couldn't find expected completion item '" + expectedItem.label + "'"
    );
    assert.equal(actualItem!.label, expectedItem.label);
    assert.equal(actualItem!.kind, expectedItem.kind);
    assert.isDefined(actualItem!.documentation);
  });
}
