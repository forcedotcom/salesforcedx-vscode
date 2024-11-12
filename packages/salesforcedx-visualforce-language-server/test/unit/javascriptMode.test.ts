/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { getLanguageService } from '@salesforce/salesforcedx-visualforce-markup-language-server';
import * as assert from 'assert';
import { TextDocument } from 'vscode-languageserver-types';
import { getLanguageModelCache } from '../../src/languageModelCache';
import * as embeddedSupport from '../../src/modes/embeddedSupport';
import { getJavascriptMode } from '../../src/modes/javascriptMode';

describe('HTML Javascript Support', () => {
  const htmlLanguageService = getLanguageService();

  const assertCompletions = (value: string, expectedProposals: string[]): void => {
    const offset = value.indexOf('|');
    value = value.substr(0, offset) + value.substr(offset + 1);

    const document = TextDocument.create('test://test/test.html', 'html', 0, value);

    const documentRegions = getLanguageModelCache<embeddedSupport.HTMLDocumentRegions>(10, 60, doc =>
      embeddedSupport.getDocumentRegions(htmlLanguageService, doc)
    );

    const mode = getJavascriptMode(documentRegions);

    const position = document.positionAt(offset);
    const list = mode.doComplete(document, position);
    assert.ok(list);

    const actualLabels = list.items.map(c => c.label).sort();
    for (const expected of expectedProposals) {
      assert.ok(actualLabels.indexOf(expected) !== -1, 'Not found:' + expected + ' is ' + actualLabels.join(', '));
    }
  };

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('Should display completions', () => {
    assertCompletions('<html><script>window.|</script></html>', ['location']);
  });
});
