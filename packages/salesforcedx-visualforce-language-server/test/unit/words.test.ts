/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import * as words from '../../src/utils/strings';

describe('Words', () => {
  const wordRegex = /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g;

  const assertWord = (value: string, expected: string): void => {
    const offset = value.indexOf('|');
    value = value.substr(0, offset) + value.substr(offset + 1);

    const actualRange = words.getWordAtText(value, offset, wordRegex);
    assert(actualRange.start <= offset);
    assert(actualRange.start + actualRange.length >= offset);
    assert.equal(value.substr(actualRange.start, actualRange.length), expected);
  };

  it('Should handle basic words', () => {
    assertWord('|var x1 = new F<A>(a, b);', 'var');
    assertWord('v|ar x1 = new F<A>(a, b);', 'var');
    assertWord('var| x1 = new F<A>(a, b);', 'var');
    assertWord('var |x1 = new F<A>(a, b);', 'x1');
    assertWord('var x1| = new F<A>(a, b);', 'x1');
    assertWord('var x1 = new |F<A>(a, b);', 'F');
    assertWord('var x1 = new F<|A>(a, b);', 'A');
    assertWord('var x1 = new F<A>(|a, b);', 'a');
    assertWord('var x1 = new F<A>(a, b|);', 'b');
    assertWord('var x1 = new F<A>(a, b)|;', '');
    assertWord('var x1 = new F<A>(a, b)|;|', '');
    assertWord('var x1 = |  new F<A>(a, b)|;|', '');
  });

  it('Should handle multiline', () => {
    assertWord('console.log("hello");\n|var x1 = new F<A>(a, b);', 'var');
    assertWord('console.log("hello");\n|\nvar x1 = new F<A>(a, b);', '');
    assertWord('console.log("hello");\n\r |var x1 = new F<A>(a, b);', 'var');
  });
});
