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
  let lwcExtension: vscode.Extension<any>;
  let docUri: vscode.Uri;
  let doc: vscode.TextDocument;
  let editor: vscode.TextEditor;
  let text: string;
  let startPosition: vscode.Position;
  let endPosition: vscode.Position;
  let selection: vscode.Selection;

  beforeEach(async() => {
    lwcDir = path.join(
      vscode.workspace.workspaceFolders![0].uri.fsPath,
      'force-app',
      'main',
      'default',
      'lwc'
    );
    lwcExtension = vscode.extensions.getExtension(
      'salesforce.salesforcedx-vscode-lwc'
    ) as vscode.Extension<any>;
    await lwcExtension.activate();
    docUri = vscode.Uri.file(path.join(lwcDir, 'hello', 'hello.js'));
    doc = await vscode.workspace.openTextDocument(docUri);
    editor = await vscode.window.showTextDocument(doc);
    startPosition = new vscode.Position(1, 0);
    endPosition = new vscode.Position(1,0);
  });

  afterEach(() => {
    try {
      selection = new vscode.Selection(startPosition, endPosition);
      // We need to clear the editor's line or the input text will change and test will fail.
      editor.edit(editBuilder => {
        editBuilder.delete(selection)
      });
    } catch (e) {
      throw e;
    }
  });

  it('lwc extension activation', async function() {
    expect(lwcExtension.isActive);
  });

  it('LWC JS Module Import Intellisense', async () => {
    // We have to have some text or we'll just get generic completions
    text = "import {} from 'c";
    endPosition = new vscode.Position(
      startPosition.line,
      startPosition.character + text.length
    );
    await editor.edit(editBuilder => {
      editBuilder.insert(startPosition, text);
    });
    const items = [
        {
        label: 'c/helloBinding',
        kind: vscode.CompletionItemKind.Folder
      },
      {
        label: 'c/hello',
        kind: vscode.CompletionItemKind.Folder
      }
    ]

    try {
      await testCompletion(docUri, endPosition, items);
    } catch (error) {
      throw error;
    }
  });

  it('LWC JS @Salesforce Import Intellisense', async () => {
    // We have to have some text or we'll just get generic completions
    text = "import {} from '@sales";
    endPosition = new vscode.Position(
      startPosition.line,
      startPosition.character + text.length
    );
    await editor.edit(editBuilder => {
      editBuilder.insert(startPosition, text);
    });
    const items = [
      {
        label: '@salesforce/salesforcedx-utils-vscode',
        kind: vscode.CompletionItemKind.Module
      },
      {
        label: '@commitlint/config-conventional',
        kind: vscode.CompletionItemKind.Module
      },
      {
        label: '@salesforce/dev-config',
        kind: vscode.CompletionItemKind.Module
      },
      {
        label: 'c/viewSource',
        kind: vscode.CompletionItemKind.Folder
      },
      {
        label: '@commitlint/cli',
        kind: vscode.CompletionItemKind.Module
      }
    ]

    try {
      await testCompletion(docUri, endPosition, items);
    } catch (error) {
      throw error;
    }
  });

  it('LWC JS Lightning Import Intellisense', async () => {
    // We have to have some text or we'll just get generic completions
    text = "import {} from 'li";
    endPosition = new vscode.Position(
      startPosition.line,
      startPosition.character + text.length
    );
    await editor.edit(editBuilder => {
      editBuilder.insert(startPosition, text);
    });
    const items = [
      {
        label: 'c/viewSource',
        kind: vscode.CompletionItemKind.Folder
      },
      {
        label: 'c/demoLwcComponent',
        kind: vscode.CompletionItemKind.Folder
      }
    ]

    try {
      await testCompletion(docUri, endPosition, items);
    } catch (error) {
      throw error;
    }
  });
});

describe('LWC MarkUp Intellisense Test Suite', function() {
  let lwcDir: string;
  let lwcExtension: vscode.Extension<any>;
  let docUri: vscode.Uri;
  let doc: vscode.TextDocument;
  let editor: vscode.TextEditor;
  let text: string;
  let startPosition: vscode.Position;
  let endPosition: vscode.Position;
  let selection: vscode.Selection;


  beforeEach(async() => {
    lwcDir = path.join(
      vscode.workspace.workspaceFolders![0].uri.fsPath,
      'force-app',
      'main',
      'default',
      'lwc'
    );
    lwcExtension = vscode.extensions.getExtension(
      'salesforce.salesforcedx-vscode-lwc'
    ) as vscode.Extension<any>;
    await lwcExtension.activate();
    docUri = vscode.Uri.file(path.join(lwcDir, 'hello', 'hello.html'));
    doc = await vscode.workspace.openTextDocument(docUri);
    editor = await vscode.window.showTextDocument(doc);
    startPosition = new vscode.Position(5, 0);
    endPosition = new vscode.Position(5,0);
  });

  afterEach(() => {
    try {
      selection = new vscode.Selection(startPosition, endPosition);
      // We need to clear the editor's line or the input text will change and test will fail.
      editor.edit(editBuilder => {
        editBuilder.delete(selection)
      });
    } catch (e) {
      throw e;
    }
  });

  it('lwc extension activation', async function() {
    expect(lwcExtension.isActive);
  });

  /**
   * Test that lwc markup intellisense includes standard lwc tags and custom lwc tags
   */
  it('LWC Markup Intellisense', async () => {
    // We have to have some text or we'll just get generic completions
    text = '<c-';
    endPosition = new vscode.Position(
      startPosition.line,
      startPosition.character + text.length
    );
    await editor.edit(editBuilder => {
      editBuilder.insert(startPosition, text);
    });
    const items = [
        {
          label: 'lightning-accordion',
          kind: vscode.CompletionItemKind.Property
        },
        {
          label: 'c-hello-binding',
          kind: vscode.CompletionItemKind.Property
        }
      ]

    try {
      // NOTE: Because the completion providers always returns all possible results and then VSCode
      // does the filtering based on what is typed, we have no good way of testing what vscode is
      // actually displaying to the user based on what we typed
      // TODO - investigate why this only happens on markup
      await testCompletion(docUri, endPosition, items);
    } catch (error) {
      throw error;
    }
  });
});

async function testCompletion(
  docUri: vscode.Uri,
  position: vscode.Position,
  expectedCompletionList: vscode.CompletionItem[]
) {
  // Simulate triggering a completion
  let actualCompletionList = (((await vscode.commands.executeCommand(
    'vscode.executeCompletionItemProvider',
    docUri,
    position
  )) as vscode.CompletionList).items).sort();

  (expectedCompletionList.sort()).map(expectedItem => {
    const actualItem = actualCompletionList.find(obj => {
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
