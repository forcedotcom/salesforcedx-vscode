/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CompletionConfiguration } from 'vscode-html-languageservice';
import { CompletionItemKind, CompletionList, TextDocument } from 'vscode-languageserver-types';
import { getVisualforceHtmlLanguageService } from '../../src/modes/visualforceHtmlLanguageService';
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
      expect(matches).toHaveLength(0);
      return;
    }

    expect(matches).toHaveLength(1);
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

  const testCompletionFor = (
    value: string,
    expected: { count?: number; items?: ItemDescription[] },
    settings?: CompletionConfiguration
  ): void => {
    const offset = value.indexOf('|');
    value = value.substr(0, offset) + value.substr(offset + 1);

    const ls = getVisualforceHtmlLanguageService();

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

  test('Visualforce metadata', () => {
    testCompletionFor('<apex:pageM|', {
      items: [{ label: 'apex:pageMessage' }]
    });

    testCompletionFor('<apex:pageMessage |', {
      items: [{ label: 'escape' }, { label: 'severity' }]
    });

    testCompletionFor('<apex:pageMessage escape="|">', {
      items: [{ label: 'true' }, { label: 'false' }]
    });
  });
});
