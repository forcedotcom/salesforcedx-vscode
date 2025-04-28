/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CompletionItemKind, CompletionList, TextDocument } from 'vscode-languageserver-types';
import * as htmlLanguageService from '../../src/htmlLanguageService';
import { applyEdits } from './textEditSupport';

type ItemDescription = {
  label: string;
  documentation?: string;
  kind?: CompletionItemKind;
  resultText?: string;
  notAvailable?: boolean;
};

describe('HTML Completion', () => {
  const assertCompletion = (
    completions: CompletionList,
    expected: ItemDescription,
    document: TextDocument,
    offset: number
  ) => {
    const matches = completions.items.filter(completion => completion.label === expected.label);
    if (expected.notAvailable) {
      expect(matches.length).toBe(0);
      return;
    }

    expect(matches.length).toBe(1);
    const match = matches[0];

    if (expected.documentation) {
      expect(match.documentation).toBe(expected.documentation);
    }
    if (expected.kind) {
      expect(match.kind).toBe(expected.kind);
    }
    if (expected.resultText) {
      if (match.textEdit && 'range' in match.textEdit) {
        expect(applyEdits(document, [match.textEdit])).toBe(expected.resultText);
      }
    }
  };

  const testCompletionFor = async (
    value: string,
    expected: { count?: number; items?: ItemDescription[] },
    settings?: htmlLanguageService.CompletionConfiguration
  ): Promise<void> => {
    const offset = value.indexOf('|');
    value = value.substr(0, offset) + value.substr(offset + 1);

    const ls = htmlLanguageService.getLanguageService();

    const document = TextDocument.create('test://test/test.page', 'visualforce', 0, value);
    const position = document.positionAt(offset);
    const vfDoc = ls.parseHTMLDocument(document);
    const list = ls.doComplete(document, position, vfDoc, settings);

    if (expected.count) {
      expect(list.items).toBe(expected.count);
    }
    if (expected.items) {
      for (const item of expected.items) {
        assertCompletion(list, item, document, offset);
      }
    }
  };

  test('Complete', async () => {
    await testCompletionFor('<|', {
      items: [
        { label: 'iframe', resultText: '<iframe' },
        { label: 'h1', resultText: '<h1' },
        { label: 'div', resultText: '<div' }
      ]
    });

    await testCompletionFor('< |', {
      items: [
        { label: 'iframe', resultText: '<iframe' },
        { label: 'h1', resultText: '<h1' },
        { label: 'div', resultText: '<div' }
      ]
    });

    await testCompletionFor('<h|', {
      items: [
        { label: 'html', resultText: '<html' },
        { label: 'h1', resultText: '<h1' },
        { label: 'header', resultText: '<header' }
      ]
    });

    await testCompletionFor('<input|', {
      items: [{ label: 'input', resultText: '<input' }]
    });

    await testCompletionFor('<inp|ut', {
      items: [{ label: 'input', resultText: '<input' }]
    });

    await testCompletionFor('<|inp', {
      items: [{ label: 'input', resultText: '<input' }]
    });

    await testCompletionFor('<input |', {
      items: [
        { label: 'type', resultText: '<input type="$1"' },
        { label: 'style', resultText: '<input style="$1"' },
        { label: 'onmousemove', resultText: '<input onmousemove="$1"' }
      ]
    });
  });
});
