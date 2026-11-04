/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SymbolKind, type DocumentSymbol } from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';
import { analyzeApexSource, type OasSourceToken } from '../../../src/oas/apexSourceMetadata';

const text = `@RestResource(
  /* mapping, with commas */ urlMapping='/v1/foo/*'
)
global with sharing class ExampleResource {
  @HttpGet
  global static String fetch() { return 'ok'; }

  @AuraEnabled(cacheable=true)
  public static String ignored() { return 'ignored'; }

  @Deprecated
  public String oldValue { get; set; }

  static { System.debug('initializing'); }

  class Nested {
    @HttpPost
    static void create() {}
  }
}`;
const resourceUri = URI.file('/project/ExampleResource.cls');

const documentedText = `/**
 * Outer resource documentation.
 */
@RestResource(urlMapping='/v1/foo/*')
global class ExampleResource {
  /** Method documentation must not become class documentation. */
  @HttpGet
  global static String fetch() { return 'ok'; }

  /** Nested documentation must not become outer documentation. */
  class Nested {
    @HttpPost
    static void create() {}
  }
}`;

type TestRange = {
  readonly start: { readonly line: number; readonly character: number };
  readonly end: { readonly line: number; readonly character: number };
};

const range = (startLine: number, startCharacter: number, endLine: number, endCharacter: number): TestRange => ({
  start: { line: startLine, character: startCharacter },
  end: { line: endLine, character: endCharacter }
});

const symbol = (
  name: string,
  kind: SymbolKind,
  declarationRange: TestRange,
  selectionRange: TestRange,
  children?: DocumentSymbol[]
): DocumentSymbol => ({
  name,
  detail: '',
  kind,
  range: declarationRange,
  selectionRange,
  children
});

const token = (
  line: number,
  character: number,
  length: number,
  tokenType: string,
  tokenModifiers: readonly string[] = []
): OasSourceToken => ({
  line,
  character,
  length,
  tokenType,
  tokenModifiers
});

describe('analyzeApexSource', () => {
  it('derives outer-class and immediate-method metadata from token anchors', () => {
    const analysis = analyzeApexSource(
      resourceUri,
      text,
      [
        token(0, 1, 12, 'decorator'),
        token(3, 26, 15, 'class', ['declaration']),
        token(4, 3, 7, 'decorator'),
        token(5, 23, 5, 'method', ['declaration', 'static']),
        token(7, 3, 11, 'decorator'),
        token(8, 23, 7, 'method', ['declaration', 'static']),
        token(10, 3, 10, 'decorator'),
        token(11, 16, 8, 'property', ['declaration']),
        token(13, 8, 6, 'class', ['declaration']),
        token(14, 5, 8, 'decorator'),
        token(15, 16, 6, 'method', ['declaration', 'static'])
      ],
      [
        symbol('ExampleResource', SymbolKind.Class, range(3, 0, 19, 1), range(3, 26, 3, 41), [
          symbol('fetch', SymbolKind.Method, range(5, 2, 5, 55), range(5, 23, 5, 28)),
          symbol('ignored', SymbolKind.Method, range(8, 2, 8, 64), range(8, 23, 8, 30)),
          symbol('oldValue', SymbolKind.Property, range(11, 2, 11, 39), range(11, 16, 11, 24)),
          symbol('Nested', SymbolKind.Class, range(15, 2, 18, 3), range(15, 8, 15, 14), [
            symbol('create', SymbolKind.Method, range(17, 4, 17, 25), range(17, 16, 17, 22))
          ])
        ])
      ]
    );

    expect(analysis?.classContext).toMatchObject({
      name: 'ExampleResource',
      annotations: [{ name: 'RestResource', parameters: { urlMapping: '/v1/foo/*' } }],
      modifiers: { visibility: 'global', isStatic: false, isConstructor: false }
    });
    expect(analysis?.methods).toMatchObject([
      {
        name: 'fetch',
        annotations: [{ name: 'HttpGet' }],
        modifiers: { visibility: 'global', isStatic: true, isConstructor: false }
      },
      {
        name: 'ignored',
        annotations: [{ name: 'AuraEnabled', parameters: { cacheable: 'true' } }],
        modifiers: { visibility: 'public', isStatic: true, isConstructor: false }
      }
    ]);
  });

  it('recognizes only constructor symbols as constructors', () => {
    const constructorText =
      'public class Example { public Example() {} public static String Example() { return null; } }';
    const analysis = analyzeApexSource(
      resourceUri,
      constructorText,
      [
        token(0, 13, 7, 'class', ['declaration']),
        token(0, 30, 7, 'method', ['declaration']),
        token(0, 64, 7, 'method', ['declaration', 'static'])
      ],
      [
        symbol('Example', SymbolKind.Class, range(0, 0, 0, 87), range(0, 13, 0, 20), [
          symbol('Example', SymbolKind.Constructor, range(0, 23, 0, 42), range(0, 30, 0, 37)),
          symbol('Example', SymbolKind.Method, range(0, 57, 0, 87), range(0, 64, 0, 71))
        ])
      ]
    );

    expect(analysis?.methods.map(method => method.modifiers)).toMatchObject([
      { visibility: 'public', isConstructor: true },
      { visibility: 'public', isStatic: true, isConstructor: false }
    ]);
  });

  it('preserves comment delimiters inside quoted annotation values', () => {
    const annotationText = "@RestResource /* mapping */ (urlMapping='/v1/*foo*/bar')\nglobal class Example {}";
    const analysis = analyzeApexSource(
      resourceUri,
      annotationText,
      [token(0, 1, 12, 'decorator'), token(1, 13, 7, 'class', ['declaration'])],
      [symbol('Example', SymbolKind.Class, range(1, 0, 1, 22), range(1, 13, 1, 20))]
    );

    expect(analysis?.classContext.annotations[0]?.parameters).toEqual({ urlMapping: '/v1/*foo*/bar' });
  });

  it('associates only contiguous documentation with its declaration', () => {
    const analysis = analyzeApexSource(
      resourceUri,
      documentedText,
      [
        token(3, 1, 12, 'decorator'),
        token(4, 13, 15, 'class', ['declaration']),
        token(6, 3, 7, 'decorator'),
        token(7, 23, 5, 'method', ['declaration', 'static']),
        token(11, 5, 8, 'decorator'),
        token(12, 16, 6, 'method', ['declaration', 'static'])
      ],
      [
        symbol('ExampleResource', SymbolKind.Class, range(4, 0, 14, 1), range(4, 13, 4, 28), [
          symbol('fetch', SymbolKind.Method, range(7, 2, 7, 55), range(7, 23, 7, 28)),
          symbol('Nested', SymbolKind.Class, range(10, 2, 14, 3), range(10, 8, 10, 14), [
            symbol('create', SymbolKind.Method, range(12, 4, 12, 25), range(12, 16, 12, 22))
          ])
        ])
      ]
    );

    expect(analysis?.classContext.documentation).toBe('/**\n * Outer resource documentation.\n */');
    expect(analysis?.methods[0]?.documentation).toBe(
      '/** Method documentation must not become class documentation. */'
    );
  });

  it('does not treat an ordinary comment separated from a declaration as documentation', () => {
    const source = '/* Ordinary comment */\nglobal class Example {}';
    const analysis = analyzeApexSource(
      resourceUri,
      source,
      [token(1, 13, 7, 'class', ['declaration'])],
      [symbol('Example', SymbolKind.Class, range(1, 0, 1, 22), range(1, 13, 1, 20))]
    );

    expect(analysis?.classContext.documentation).toBeUndefined();
  });

  it('does not inherit the outer class visibility for an unmodified first method', () => {
    const defaultMethodText = 'global class Example { static void fetch() {} }';
    const analysis = analyzeApexSource(
      resourceUri,
      defaultMethodText,
      [token(0, 13, 7, 'class', ['declaration']), token(0, 35, 5, 'method', ['declaration', 'static'])],
      [
        symbol('Example', SymbolKind.Class, range(0, 0, 0, 45), range(0, 13, 0, 20), [
          symbol('fetch', SymbolKind.Method, range(0, 23, 0, 44), range(0, 35, 0, 40))
        ])
      ]
    );

    expect(analysis?.methods[0]?.modifiers).toMatchObject({ visibility: 'default', isStatic: true });
  });

  it('normalizes case-insensitive Apex visibility keywords', () => {
    const mixedCaseText = 'GLOBAL class Example { PUBLIC static void fetch() {} }';
    const analysis = analyzeApexSource(
      resourceUri,
      mixedCaseText,
      [token(0, 13, 7, 'class', ['declaration']), token(0, 43, 5, 'method', ['declaration', 'static'])],
      [
        symbol('Example', SymbolKind.Class, range(0, 0, 0, 53), range(0, 13, 0, 20), [
          symbol('fetch', SymbolKind.Method, range(0, 23, 0, 52), range(0, 43, 0, 48))
        ])
      ]
    );

    expect(analysis?.classContext.modifiers.visibility).toBe('global');
    expect(analysis?.methods[0]?.modifiers.visibility).toBe('public');
  });
});
