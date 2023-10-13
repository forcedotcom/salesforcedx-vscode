/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { assert, expect } from 'chai';
import * as path from 'path';
import {
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  Extension,
  Position,
  Selection,
  TextDocument,
  TextEditor,
  Uri,
  commands,
  extensions,
  window,
  workspace
} from 'vscode';

describe('LWC Intellisense Integration Tests', () => {
  let lwcExtension: Extension<any>;

  before(async () => {
    lwcExtension = extensions.getExtension(
      'salesforce.salesforcedx-vscode-lwc'
    ) as Extension<any>;
    await lwcExtension.activate();
  });

  it('LWC Extension Activation', async () => {
    expect(lwcExtension.isActive);
  });

  describe('LWC JS Intellisense Test Suite', function() {
    // Time taken to execute the command to fetch actualcompletion list, varies with different environment and system.
    // tslint:disable-next-line:no-invalid-this
    this.timeout(10000);
    let doc: TextDocument;
    let editor: TextEditor;
    let text: string;
    let startPosition: Position;
    let endPosition: Position;
    let selection: Selection;
    const lwcDir = path.join(
      workspace.workspaceFolders![0].uri.fsPath,
      'force-app',
      'main',
      'default',
      'lwc'
    );
    const docUri = Uri.file(path.join(lwcDir, 'hello', 'hello.js'));

    beforeEach(async () => {
      doc = await workspace.openTextDocument(docUri);
      editor = await window.showTextDocument(doc);
      startPosition = new Position(1, 0);
      // To provide valid arguments to selection in afterEach, setting default value of endPosition same as startPosition.
      endPosition = new Position(1, 0);
    });

    afterEach(() => {
      selection = new Selection(startPosition, endPosition);
      // We need to clear the editor's line or the input text will change and test will fail.
      editor.edit(editBuilder => {
        editBuilder.delete(selection);
      });
    });

    it('LWC JS Module Import Intellisense', async () => {
      // We have to have some text or we'll just get generic completions
      text = "import {} from 'c";
      endPosition = new Position(
        startPosition.line,
        startPosition.character + text.length
      );
      await editor.edit(editBuilder => {
        editBuilder.insert(startPosition, text);
      });
      const items = [
        {
          label: 'c/helloBinding',
          kind: CompletionItemKind.Folder
        },
        {
          label: 'c/hello',
          kind: CompletionItemKind.Folder
        }
      ];
      await testCompletion(docUri, endPosition, items);
    });

    it('LWC JS @Salesforce Import Intellisense', async () => {
      text = "import {} from '@sales";
      endPosition = new Position(
        startPosition.line,
        startPosition.character + text.length
      );
      await editor.edit(editBuilder => {
        editBuilder.insert(startPosition, text);
      });
      // Keeping a salesforce module, a local folder and dependency module in the expected completion list
      const items = [
        {
          label: '@salesforce/dev-config',
          kind: CompletionItemKind.Module
        },
        {
          label: 'c/viewSource',
          kind: CompletionItemKind.Folder
        },
        {
          label: '@commitlint/cli',
          kind: CompletionItemKind.Module
        }
      ];
      await testCompletion(docUri, endPosition, items);
    });

    it('LWC JS Lightning Import Intellisense', async () => {
      text = "import {} from 'li";
      endPosition = new Position(
        startPosition.line,
        startPosition.character + text.length
      );
      await editor.edit(editBuilder => {
        editBuilder.insert(startPosition, text);
      });
      const items = [
        {
          label: 'c/viewSource',
          kind: CompletionItemKind.Folder
        },
        {
          label: 'c/demoLwcComponent',
          kind: CompletionItemKind.Folder
        }
      ];
      await testCompletion(docUri, endPosition, items);
    });
  });

  describe('LWC MarkUp Intellisense Test Suite', function() {
    let doc: TextDocument;
    let editor: TextEditor;
    let text: string;
    let startPosition: Position;
    let endPosition: Position;
    let selection: Selection;
    const lwcDir = path.join(
      workspace.workspaceFolders![0].uri.fsPath,
      'force-app',
      'main',
      'default',
      'lwc'
    );
    const docUri = Uri.file(path.join(lwcDir, 'hello', 'hello.html'));

    beforeEach(async () => {
      doc = await workspace.openTextDocument(docUri);
      editor = await window.showTextDocument(doc);
      startPosition = new Position(5, 0);
      endPosition = new Position(5, 0);
    });

    afterEach(() => {
      selection = new Selection(startPosition, endPosition);
      editor.edit(editBuilder => {
        editBuilder.delete(selection);
      });
    });

    /**
     * Test that lwc markup intellisense includes standard lwc tags and custom lwc tags
     */
    it('LWC Markup Intellisense', async () => {
      text = '<c-';
      endPosition = new Position(
        startPosition.line,
        startPosition.character + text.length
      );
      await editor.edit(editBuilder => {
        editBuilder.insert(startPosition, text);
      });
      const items = [
        {
          label: 'lightning-accordion',
          kind: CompletionItemKind.Property
        },
        {
          label: 'c-hello-binding',
          kind: CompletionItemKind.Property
        }
      ];

      // NOTE: Because the completion providers always returns all possible results and then VSCode
      // does the filtering based on what is typed, we have no good way of testing what vscode is
      // actually displaying to the user based on what we typed
      // TODO - investigate why this only happens on markup
      await testCompletion(docUri, endPosition, items);
    });
  });
});

async function testCompletion(
  docUri: Uri,
  position: Position,
  expectedCompletionList: CompletionItem[]
) {
  // Simulate triggering a completion
  const actualCompletionList = ((await commands.executeCommand(
    'vscode.executeCompletionItemProvider',
    docUri,
    position
  )) as CompletionList).items;

  actualCompletionList.sort();
  expectedCompletionList.sort();

  expectedCompletionList.forEach(expectedItem => {
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
  });
}
