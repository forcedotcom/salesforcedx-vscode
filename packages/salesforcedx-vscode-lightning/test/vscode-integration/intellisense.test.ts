/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { assert, expect } from 'chai';
import * as path from 'path';
import * as vscode from 'vscode';

describe('Aura Intellisense Test Suite', function() {
  let auraDir: string;
  let doc: vscode.TextDocument;
  let editor: vscode.TextEditor;

  before(async function() {
    auraDir = path.join(
      vscode.workspace.workspaceFolders![0].uri.fsPath,
      'force-app',
      'main',
      'default',
      'aura'
    );
  });

  afterEach(async function() {
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
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

    // We have to have some text or we'll just get generic completions
    const text = '<c:';
    const startPosition = new vscode.Position(1, 7);
    const endPosition = new vscode.Position(
      startPosition.line,
      startPosition.character + text.length
    );
    const rangeReplace = new vscode.Range(startPosition, endPosition);
    await editor.edit(editBuilder => {
      editBuilder.replace(rangeReplace, text);
    });

    console.log('TRACE:KRIS:markup:intellisense', editor.document.getText());

    try {
      console.log('TRACE:KRIS', 'aura:markup:start');
      await testCompletion(docUri, endPosition, {
        items: [
          // Aura system attributes
          { label: 'aura:attribute', kind: vscode.CompletionItemKind.Property },
          // Standard components
          {
            label: 'lightning:button',
            kind: vscode.CompletionItemKind.Property
          },
          // Custom Aura
          { label: 'c:DemoApp', kind: vscode.CompletionItemKind.Property },
          // Custom LWC
          {
            label: 'c:demoLwcComponent',
            kind: vscode.CompletionItemKind.Property
          }
        ]
      });
      console.log('TRACE:KRIS', 'aura:markup:end');
    } catch (error) {
      throw error;
    }
  });

  /**
   * Test aura javascript completions
   */

  it('Aura global javascript intellisense', async function() {
    const docUri = vscode.Uri.file(
      path.join(auraDir, 'DemoComponent', 'DemoComponentController.js')
    );
    doc = await vscode.workspace.openTextDocument(docUri);
    editor = await vscode.window.showTextDocument(doc);

    // We have to have some text or we'll just get generic completions
    const text = '$A.util.get';
    const startPosition = new vscode.Position(2, 3);
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
          { label: 'getBooleanValue', kind: vscode.CompletionItemKind.Function }
        ]
      });
    } catch (error) {
      throw error;
    }
  });

  it('Aura property javascript intellisense', async function() {
    const docUri = vscode.Uri.file(
      path.join(auraDir, 'DemoComponent', 'DemoComponentController.js')
    );
    doc = await vscode.workspace.openTextDocument(docUri);
    editor = await vscode.window.showTextDocument(doc);

    // We have to have some text or we'll just get generic completions
    const text = 'component.get';
    const startPosition = new vscode.Position(2, 3);
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
        items: [{ label: 'getEvent', kind: vscode.CompletionItemKind.Function }]
      });
    } catch (error) {
      throw error;
    }
  });

  it('Aura helper javascript intellisense', async function() {
    const docUri = vscode.Uri.file(
      path.join(auraDir, 'DemoComponent', 'DemoComponentController.js')
    );
    doc = await vscode.workspace.openTextDocument(docUri);
    editor = await vscode.window.showTextDocument(doc);

    // We have to have some text or we'll just get generic completions
    const text = 'helper.hel';
    const startPosition = new vscode.Position(2, 3);
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
          { label: 'helperFunction', kind: vscode.CompletionItemKind.Function }
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
  console.log('TRACE:KRIS:executeCompletionItemProvider:before');
  // Simulate triggering a completion
  const actualCompletionList = (await vscode.commands.executeCommand(
    'vscode.executeCompletionItemProvider',
    docUri,
    position
  )) as vscode.CompletionList;
  console.log(
    'TRACE:KRIS:executeCompletionItemProvider:end',
    expectedCompletionList
  );

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
    console.log('TRACE:KRIS', actualItem, expectedCompletionList);
    assert.isDefined(actualItem!.documentation);
  });
}
