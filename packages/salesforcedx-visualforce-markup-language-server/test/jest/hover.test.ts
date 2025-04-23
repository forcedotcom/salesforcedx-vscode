/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { TextDocument } from 'vscode-languageserver-types';
import * as htmlLanguageService from '../../src/htmlLanguageService';

describe('HTML Hover', () => {
  const assertHover = (
    value: string,
    expectedHoverLabel: string | undefined,
    expectedHoverOffset: number | undefined
  ): void => {
    const offset = value.indexOf('|');
    value = value.substr(0, offset) + value.substr(offset + 1);

    const document = TextDocument.create('test://test/test.html', 'html', 0, value);

    const position = document.positionAt(offset);
    const ls = htmlLanguageService.getLanguageService();
    const htmlDoc = ls.parseHTMLDocument(document);

    const hover = ls.doHover(document, position, htmlDoc);
    expect(hover?.contents[0].value).toBe(expectedHoverLabel);
    expect(hover && document.offsetAt(hover.range.start)).toBe(expectedHoverOffset);
  };

  test('Single', () => {
    assertHover('|<html></html>', undefined, undefined);
    assertHover('<|html></html>', '<html>', 1);
    assertHover('<h|tml></html>', '<html>', 1);
    assertHover('<htm|l></html>', '<html>', 1);
    assertHover('<html|></html>', '<html>', 1);
    assertHover('<html>|</html>', undefined, undefined);
    assertHover('<html><|/html>', undefined, undefined);
    assertHover('<html></|html>', '</html>', 8);
    assertHover('<html></h|tml>', '</html>', 8);
    assertHover('<html></ht|ml>', '</html>', 8);
    assertHover('<html></htm|l>', '</html>', 8);
    assertHover('<html></html|>', '</html>', 8);
    assertHover('<html></html>|', undefined, undefined);
  });
});
