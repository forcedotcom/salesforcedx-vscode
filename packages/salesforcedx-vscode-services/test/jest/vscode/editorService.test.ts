/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { EditorService } from '../../../src/vscode/editorService';

describe('EditorService', () => {
  it('includes the cursor position in context when selection is empty', async () => {
    const documentUri = URI.file('/project/classes/Example.cls');
    Object.defineProperty(vscode.window, 'activeTextEditor', {
      configurable: true,
      value: {
        document: { uri: documentUri, getText: jest.fn(() => 'class Example {}') },
        selection: { isEmpty: true, start: { line: 7, character: 12 } }
      }
    });

    const context = await Effect.runPromise(
      Effect.scoped(Effect.provide(EditorService.getActiveEditorContext(true), EditorService.Default))
    );

    expect(context).toEqual({
      text: 'class Example {}',
      documentUri,
      selectionRange: { startLine: 7, startCharacter: 12 }
    });
  });
});
