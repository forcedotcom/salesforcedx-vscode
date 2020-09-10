/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { assert, expect } from 'chai';
import * as path from 'path';
import * as vscode from 'vscode';

describe('LWC Intellisense Test Suite', function() {
  let lwcDir: string;

  before(function() {
    lwcDir = path.join(
      vscode.workspace.workspaceFolders![0].uri.fsPath,
      'force-app',
      'main',
      'default',
      'lwc'
    );
  });

  afterEach(async function() {
    try {
      await vscode.commands.executeCommand(
        'workbench.action.closeActiveEditor'
      );
    } catch (e) {
      throw e;
    }
  });

  /**
   * Test that lwc markup intellisense includes standard lwc tags and custom lwc tags
   */
  it('LWC Markup Intellisense', async function() {
    const docUri = vscode.Uri.file(path.join(lwcDir, 'hello', 'hello.html'));
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // We have to have some text or we'll just get generic completions
    const text = '<c-';
    const startPosition = new vscode.Position(5, 0);
    const endPosition = new vscode.Position(
      startPosition.line,
      startPosition.character + text.length
    );
    const rangeReplace = new vscode.Range(startPosition, endPosition);
    await editor.edit(editBuilder => {
      editBuilder.replace(rangeReplace, text);
    });

    try {
      // NOTE: Because the completion providers always returns all possible results and then VSCode
      // does the filtering based on what is typed, we have no good way of testing what vscode is
      // actually displaying to the user based on what we typed
      // TODO - investigate why this only happens on markup
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

  xit('LWC JS @Salesforce Import Intellisense', async function() {
    this.timeout(10000);
    const docUri = vscode.Uri.file(path.join(lwcDir, 'hello', 'hello.js'));
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

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
            label: '@salesforce/apex',
            kind: vscode.CompletionItemKind.Module
          },
          // TODO add these back once we determine why Apex language server isn't working on windows
          // {
          //   label: '@salesforce/apex/AccountController.getAccountList',
          //   kind: vscode.CompletionItemKind.Module
          // },
          // {
          //   label: '@salesforce/apex/ContactController.findContacts',
          //   kind: vscode.CompletionItemKind.Module
          // },
          {
            label: '@salesforce/contentAssetUrl/Cookpatternv1',
            kind: vscode.CompletionItemKind.Module
          },
          {
            label: '@salesforce/resourceUrl/d3',
            kind: vscode.CompletionItemKind.Module
          },
          {
            label: '@salesforce/resourceUrl/trailhead_logo',
            kind: vscode.CompletionItemKind.Module
          },
          {
            label: '@salesforce/schema',
            kind: vscode.CompletionItemKind.Module
          },
          {
            label: '@salesforce/user/Id',
            kind: vscode.CompletionItemKind.Module
          }
        ]
      });
    } catch (error) {
      throw error;
    }
  });

  it('LWC JS Module Import Intellisense', async function() {
    const docUri = vscode.Uri.file(path.join(lwcDir, 'hello', 'hello.js'));
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // We have to have some text or we'll just get generic completions
    const text = "import {} from 'c";
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
            label: 'c/helloBinding',
            kind: vscode.CompletionItemKind.Folder
          }
        ]
      });
    } catch (error) {
      throw error;
    }
  });

  xit('LWC JS Lightning Import Intellisense', async function() {
    const docUri = vscode.Uri.file(path.join(lwcDir, 'hello', 'hello.js'));
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // We have to have some text or we'll just get generic completions
    const text = "import {} from 'lightn";
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
            label: 'lightning/uiListApi',
            kind: vscode.CompletionItemKind.Module
          },
          {
            label: 'lightning/uiRecordApi',
            kind: vscode.CompletionItemKind.Module
          }
        ]
      });
    } catch (error) {
      throw error;
    }
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
    assert.equal(
      actualItem!.label,
      expectedItem.label,
      'Expected completion item to have label: ' + expectedItem.label
    );
    assert.equal(
      actualItem!.kind,
      expectedItem.kind,
      "Expected completion item'" +
        expectedItem.label +
        "' to have type: " +
        expectedItem.kind
    );
    // TODO do we want some kind of documentation test?
    //assert.isDefined(actualItem!.documentation);
  });
}
