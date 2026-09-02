/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { MarkupContent, MarkedString, TextDocument } from 'vscode-languageserver-types';
import { getVisualforceHtmlLanguageService } from '../../src/modes/visualforceHtmlLanguageService';

describe('HTML Hover', () => {
  const assertHoverFor =
    (uri: string, languageId: string) =>
    (value: string, expectedHoverLabel: string | undefined, expectedHoverOffset: number | undefined): void => {
      const offset = value.indexOf('|');
      value = value.substr(0, offset) + value.substr(offset + 1);

      const document = TextDocument.create(uri, languageId, 0, value);

      const position = document.positionAt(offset);
      const ls = getVisualforceHtmlLanguageService();
      const htmlDoc = ls.parseHTMLDocument(document);

      const hover = ls.doHover(document, position, htmlDoc);
      const contents = hover?.contents as (MarkupContent | MarkedString)[] | undefined;
      const firstContent = contents?.[0];
      expect(typeof firstContent === 'string' ? firstContent : firstContent?.value).toBe(expectedHoverLabel);
      expect(hover ? document.offsetAt(hover.range.start) : undefined).toBe(expectedHoverOffset);
    };

  const assertHover = assertHoverFor('test://test/test.html', 'html');
  const assertVisualforceHover = assertHoverFor('test://test/test.page', 'visualforce');

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

  test('Visualforce mixed-case tags render original case', () => {
    assertVisualforceHover('<apex:pageBl|ock></apex:pageBlock>', '<apex:pageBlock>', 1);
    assertVisualforceHover('<apex:pageBlock></apex:pageBl|ock>', '</apex:pageBlock>', 18);
    assertVisualforceHover('<apex:outputFi|eld></apex:outputField>', '<apex:outputField>', 1);
    assertVisualforceHover('<apex:outputField></apex:outputFi|eld>', '</apex:outputField>', 20);
  });
});
