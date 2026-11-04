/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SymbolKind, type DocumentSymbol } from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';
import type { OasAnnotation, OasMethodContext, OasSourceAnalysis } from '../../../src/oas/apexSourceMetadata';
import { qualifyOasAnalysis } from '../../../src/oas/oasQualification';

const symbol = (name: string, kind: SymbolKind): DocumentSymbol => ({
  name,
  detail: '',
  kind,
  range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
  selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
});

const annotation = (name: string): OasAnnotation => ({
  name,
  parameters: {},
  range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
});

const method = (
  name: string,
  annotations: readonly OasAnnotation[],
  isStatic = false,
  isConstructor = false
): OasMethodContext => ({
  name,
  annotations,
  symbol: symbol(name, isConstructor ? SymbolKind.Constructor : SymbolKind.Method),
  modifiers: { visibility: 'public', isStatic, isConstructor }
});

const analysis = (
  classAnnotations: readonly OasAnnotation[],
  methods: readonly OasMethodContext[]
): OasSourceAnalysis => ({
  resourceUri: URI.file('/project/Example.cls'),
  text: '',
  classContext: {
    name: 'Example',
    annotations: classAnnotations,
    symbol: symbol('Example', SymbolKind.Class),
    modifiers: { visibility: 'global', isStatic: false, isConstructor: false }
  },
  methods
});

describe('qualifyOasAnalysis', () => {
  it('rejects REST resources because REST generation is retired', () => {
    const get = method('getRecord', [annotation('HttpGet')], true);
    const post = method('postRecord', [annotation('HttpPost')], true);
    const instance = method('ignored', [annotation('HttpDelete')]);

    expect(qualifyOasAnalysis(analysis([annotation('RestResource')], [get, post, instance]))).toEqual({
      framework: 'restUnsupported'
    });
  });

  it('rejects HTTP annotations without a RestResource class annotation', () => {
    expect(qualifyOasAnalysis(analysis([], [method('getRecord', [annotation('HttpGet')])]))).toEqual({
      framework: 'restUnsupported'
    });
  });

  it('selects AuraEnabled methods only when the class has no annotations', () => {
    const aura = method('getRecord', [annotation('AuraEnabled')], true);

    expect(qualifyOasAnalysis(analysis([], [aura]))).toEqual({ framework: 'aura', methods: [aura] });
    expect(qualifyOasAnalysis(analysis([annotation('Deprecated')], [aura]))).toEqual({
      framework: 'invalid',
      reason: 'classAnnotationsBlockAura'
    });
  });

  it('rejects mixed framework indicators before selecting a generator', () => {
    expect(
      qualifyOasAnalysis(analysis([annotation('RestResource')], [method('getRecord', [annotation('AuraEnabled')])]))
    ).toEqual({
      framework: 'mixed'
    });
  });

  it.each([['noEligibleMethods', analysis([], [method('Example', [annotation('AuraEnabled')], false, true)])]])(
    'reports %s for an invalid framework shape',
    (reason, source) => {
      expect(qualifyOasAnalysis(source)).toEqual({ framework: 'invalid', reason });
    }
  );
});
