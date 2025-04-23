/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { Range, TextDocument } from 'vscode-languageserver-types';
import { getLanguageService } from '../../src/htmlLanguageService';
import { applyEdits } from './textEditSupport';

describe('JSON Formatter', () => {
  const format = (unformatted: string, expected: string, insertSpaces = true) => {
    let range: Range | null = null;
    const uri = 'test://test.html';

    const rangeStart = unformatted.indexOf('|');
    const rangeEnd = unformatted.lastIndexOf('|');
    if (rangeStart !== -1 && rangeEnd !== -1) {
      // remove '|'
      unformatted =
        unformatted.substring(0, rangeStart) +
        unformatted.substring(rangeStart + 1, rangeEnd) +
        unformatted.substring(rangeEnd + 1);
      const unformattedDoc = TextDocument.create(uri, 'html', 0, unformatted);
      const startPos = unformattedDoc.positionAt(rangeStart);
      const endPos = unformattedDoc.positionAt(rangeEnd - 1);
      range = Range.create(startPos, endPos);
    }

    const document = TextDocument.create(uri, 'html', 0, unformatted);
    const edits = getLanguageService().format(document, range, {
      tabSize: 2,
      insertSpaces,
      unformatted: ''
    });
    const formatted = applyEdits(document, edits);
    expect(formatted).toBe(expected);
  };

  test('full document', () => {
    const content = ['<div  class = "foo">', '<br>', ' </div>'].join('\n');
    const expected = ['<div class="foo">', '  <br>', '</div>'].join('\n');

    format(content, expected);
  });

  test('range', () => {
    const content = ['<div  class = "foo">', '  |<img  src = "foo">|', ' </div>'].join('\n');
    const expected = ['<div  class = "foo">', '  <img src="foo">', ' </div>'].join('\n');

    format(content, expected);
  });

  test('range 2', () => {
    const content = ['<div  class = "foo">', '  |<img  src = "foo">|', '  ', ' </div>'].join('\n');
    const expected = ['<div  class = "foo">', '  <img src="foo">', '  ', ' </div>'].join('\n');

    format(content, expected);
  });

  test('range 3', () => {
    const content = ['<div  class = "foo">', '  |<img  src = "foo">|    ', '  ', ' </div>'].join('\n');
    const expected = ['<div  class = "foo">', '  <img src="foo">', '  ', ' </div>'].join('\n');

    format(content, expected);
  });

  test('range with class', () => {
    const content = ['<div |class= "foo"|>'].join('\n');
    const expected = ['<div class= "foo">'].join('\n');

    format(content, expected);
  });

  test('range with indent', () => {
    const content = ['<div  class = "foo">', '  |<img src = "foo">', '  <img  src = "foo">|', ' </div>'].join('\n');
    const expected = ['<div  class = "foo">', '  <img src="foo">', '  <img src="foo">', ' </div>'].join('\n');

    format(content, expected);
  });

  test('range with indent 2', () => {
    const content = ['<div  class = "foo">', '|  <img  src = "foo">', '  <img  src = "foo">|', ' </div>'].join('\n');
    const expected = ['<div  class = "foo">', '  <img src="foo">', '  <img src="foo">', ' </div>'].join('\n');

    format(content, expected);
  });

  test('range with indent 3', () => {
    const content = ['<div  class = "foo">', '  <div></div>   |<img  src = "foo"|>', ' </div>'].join('\n');
    const expected = ['<div  class = "foo">', '  <div></div> <img src="foo">', ' </div>'].join('\n');

    format(content, expected);
  });
});
