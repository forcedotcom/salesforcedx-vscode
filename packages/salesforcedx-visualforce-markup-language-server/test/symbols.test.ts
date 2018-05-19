/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { expect } from 'chai';
import {
  Location,
  Range,
  SymbolInformation,
  SymbolKind,
  TextDocument
} from 'vscode-languageserver-types';
import * as htmlLanguageService from '../src/htmlLanguageService';

describe('HTML Symbols', () => {
  const TEST_URI = 'test://test/test.html';

  const assertSymbols = (
    symbols: SymbolInformation[],
    expected: SymbolInformation[]
  ) => {
    expect(symbols).to.deep.equal(expected);
  };

  const testSymbolsFor = (value: string, expected: SymbolInformation[]) => {
    const ls = htmlLanguageService.getLanguageService();
    const document = TextDocument.create(TEST_URI, 'html', 0, value);
    const htmlDoc = ls.parseHTMLDocument(document);
    const symbols = ls.findDocumentSymbols(document, htmlDoc);
    assertSymbols(symbols, expected);
  };

  it('Simple', () => {
    testSymbolsFor('<div></div>', [
      {
        containerName: '',
        name: 'div',
        kind: SymbolKind.Field as SymbolKind,
        location: Location.create(TEST_URI, Range.create(0, 0, 0, 11))
      } as SymbolInformation
    ]);
    testSymbolsFor('<div><input checked id="test" class="checkbox"></div>', [
      {
        containerName: '',
        name: 'div',
        kind: SymbolKind.Field as SymbolKind,
        location: Location.create(TEST_URI, Range.create(0, 0, 0, 53))
      },
      {
        containerName: 'div',
        name: 'input#test.checkbox',
        kind: SymbolKind.Field as SymbolKind,
        location: Location.create(TEST_URI, Range.create(0, 5, 0, 47))
      }
    ]);
  });

  it('Id and classes', () => {
    const content =
      '<html id=\'root\'><body id="Foo" class="bar"><div class="a b"></div></body></html>';

    const expected = [
      {
        name: 'html#root',
        kind: SymbolKind.Field,
        containerName: '',
        location: Location.create(TEST_URI, Range.create(0, 0, 0, 80))
      },
      {
        name: 'body#Foo.bar',
        kind: SymbolKind.Field,
        containerName: 'html#root',
        location: Location.create(TEST_URI, Range.create(0, 16, 0, 73))
      },
      {
        name: 'div.a.b',
        kind: SymbolKind.Field,
        containerName: 'body#Foo.bar',
        location: Location.create(TEST_URI, Range.create(0, 43, 0, 66))
      }
    ];

    testSymbolsFor(content, expected);
  });

  it('Self closing', () => {
    const content = '<html><br id="Foo"><br id=Bar></html>';

    const expected = [
      {
        name: 'html',
        kind: SymbolKind.Field,
        containerName: '',
        location: Location.create(TEST_URI, Range.create(0, 0, 0, 37))
      },
      {
        name: 'br#Foo',
        kind: SymbolKind.Field,
        containerName: 'html',
        location: Location.create(TEST_URI, Range.create(0, 6, 0, 19))
      },
      {
        name: 'br#Bar',
        kind: SymbolKind.Field,
        containerName: 'html',
        location: Location.create(TEST_URI, Range.create(0, 19, 0, 30))
      }
    ];

    testSymbolsFor(content, expected);
  });

  it('No attrib', () => {
    const content = '<html><body><div></div></body></html>';

    const expected = [
      {
        name: 'html',
        kind: SymbolKind.Field,
        containerName: '',
        location: Location.create(TEST_URI, Range.create(0, 0, 0, 37))
      },
      {
        name: 'body',
        kind: SymbolKind.Field,
        containerName: 'html',
        location: Location.create(TEST_URI, Range.create(0, 6, 0, 30))
      },
      {
        name: 'div',
        kind: SymbolKind.Field,
        containerName: 'body',
        location: Location.create(TEST_URI, Range.create(0, 12, 0, 23))
      }
    ];

    testSymbolsFor(content, expected);
  });
});
