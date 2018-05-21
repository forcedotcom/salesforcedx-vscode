/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import { TextDocument } from 'vscode-languageserver-types';
import * as htmlLanguageService from '../src/htmlLanguageService';

describe('HTML Hover', () => {
  function assertHover(
    value: string,
    expectedHoverLabel: string,
    expectedHoverOffset
  ): void {
    const offset = value.indexOf('|');
    value = value.substr(0, offset) + value.substr(offset + 1);

    const document = TextDocument.create(
      'test://test/test.html',
      'html',
      0,
      value
    );

    const position = document.positionAt(offset);
    const ls = htmlLanguageService.getLanguageService();
    const htmlDoc = ls.parseHTMLDocument(document);

    const hover = ls.doHover(document, position, htmlDoc);
    assert.equal(hover && hover.contents[0].value, expectedHoverLabel);
    assert.equal(
      hover && document.offsetAt(hover.range.start),
      expectedHoverOffset
    );
  }

  it('Single', () => {
    assertHover('|<html></html>', void 0, void 0);
    assertHover('<|html></html>', '<html>', 1);
    assertHover('<h|tml></html>', '<html>', 1);
    assertHover('<htm|l></html>', '<html>', 1);
    assertHover('<html|></html>', '<html>', 1);
    assertHover('<html>|</html>', void 0, void 0);
    assertHover('<html><|/html>', void 0, void 0);
    assertHover('<html></|html>', '</html>', 8);
    assertHover('<html></h|tml>', '</html>', 8);
    assertHover('<html></ht|ml>', '</html>', 8);
    assertHover('<html></htm|l>', '</html>', 8);
    assertHover('<html></html|>', '</html>', 8);
    assertHover('<html></html>|', void 0, void 0);
  });
});
