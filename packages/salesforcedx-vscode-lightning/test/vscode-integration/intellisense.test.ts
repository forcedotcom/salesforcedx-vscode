/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { assert, expect } from 'chai';
import * as path from 'path';
import * as vscode from 'vscode';

describe('Aura Intellisense Test Suite', () => {
  let auraDir: string;

  beforeEach(async () => {
    auraDir = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, 'force-app', 'main', 'default', 'aura');
    await new Promise(r => setTimeout(r, 1000));
  });

  afterEach(async () => {
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  /**
   * Test that aura markup intellisense contains aura, lightning, custom aura, custom lwc tags
   */

  it('Aura markup intellisense', async () => {
    const docUri = vscode.Uri.file(path.join(auraDir, 'DemoComponent', 'DemoComponent.cmp'));
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // We have to have some text or we'll just get generic completions
    const text = '<c:';
    const startPosition = new vscode.Position(1, 7);
    const endPosition = new vscode.Position(startPosition.line, startPosition.character + text.length);
    const rangeReplace = new vscode.Range(startPosition, endPosition);
    await editor.edit(editBuilder => {
      editBuilder.replace(rangeReplace, text);
    });

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
        {
          label: 'c:DemoApp',
          kind: vscode.CompletionItemKind.Property
        } /*,
          // NOTE: this commented out since it caused the test to inconsistently fail
          // in the autobuilds, this area is covered by tests in the lang server repo.
          // Custom LWC
          {
            label: 'c:demoLwcComponent',
            kind: vscode.CompletionItemKind.Property
          }*/
      ]
    });
  });

  /**
   * Test aura javascript completions
   */

  it('Aura global javascript intellisense', async () => {
    const docUri = vscode.Uri.file(path.join(auraDir, 'DemoComponent', 'DemoComponentController.js'));
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // We have to have some text or we'll just get generic completions
    const text = '$A.util.get';
    const startPosition = new vscode.Position(2, 3);
    const endPosition = new vscode.Position(startPosition.line, startPosition.character + text.length);
    const rangeReplace = new vscode.Range(startPosition, endPosition);
    await editor.edit(editBuilder => {
      editBuilder.replace(rangeReplace, text);
    });

    await testCompletion(docUri, endPosition, {
      items: [{ label: 'getBooleanValue', kind: vscode.CompletionItemKind.Function }]
    });
  });

  it('Aura property javascript intellisense', async () => {
    const docUri = vscode.Uri.file(path.join(auraDir, 'DemoComponent', 'DemoComponentController.js'));
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // We have to have some text or we'll just get generic completions
    const text = 'component.get';
    const startPosition = new vscode.Position(2, 3);
    const endPosition = new vscode.Position(startPosition.line, startPosition.character + text.length);
    const rangeReplace = new vscode.Range(startPosition, endPosition);
    await editor.edit(editBuilder => {
      editBuilder.replace(rangeReplace, text);
    });

    await testCompletion(docUri, endPosition, {
      items: [{ label: 'getEvent', kind: vscode.CompletionItemKind.Function }]
    });
  });

  it('Aura helper javascript intellisense', async () => {
    const docUri = vscode.Uri.file(path.join(auraDir, 'DemoComponent', 'DemoComponentController.js'));
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // We have to have some text or we'll just get generic completions
    const text = 'helper.hel';
    const startPosition = new vscode.Position(2, 3);
    const endPosition = new vscode.Position(startPosition.line, startPosition.character + text.length);
    const rangeReplace = new vscode.Range(startPosition, endPosition);
    await editor.edit(editBuilder => {
      editBuilder.replace(rangeReplace, text);
    });

    await testCompletion(docUri, endPosition, {
      items: [{ label: 'helperFunction', kind: vscode.CompletionItemKind.Function }]
    });
  });
});

// NOTE: Because the completion providers always returns all possible results and then VSCode
// does the filtering based on what is typed, we have no good way of testing what vscode is
// actually displaying to the user based on what we typed
const testCompletion = async (
  docUri: vscode.Uri,
  position: vscode.Position,
  expectedCompletionList: vscode.CompletionList
) => {
  // Simulate triggering a completion

  const actualCompletionList = (await vscode.commands.executeCommand(
    'vscode.executeCompletionItemProvider',
    docUri,
    position
  )) as vscode.CompletionList;

  expectedCompletionList.items.forEach(expectedItem => {
    const actualItem = actualCompletionList.items.find(obj => {
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
      "Expected completion item'" + expectedItem.label + "' to have type: " + expectedItem.kind
    );
    if (actualItem?.detail === 'Lightning') {
      assert.isDefined(
        actualItem!.documentation,
        "Expected completion item '" + expectedItem.label + "' to have documentation"
      );
    }
  });
};
