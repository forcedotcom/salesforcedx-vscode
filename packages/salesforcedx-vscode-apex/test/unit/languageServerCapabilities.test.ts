/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { resolveLanguageServerCapabilities } from '../../src/languageServerCapabilities';

describe('resolveLanguageServerCapabilities', () => {
  it('matches the current Jorje production capability baseline', () => {
    const resolved = resolveLanguageServerCapabilities();

    expect(resolved.lsp).toEqual({
      provideCodeActions: { supported: true, enabled: true },
      provideCodeLenses: { supported: true, enabled: true },
      provideCompletions: { supported: true, enabled: true },
      provideDefinition: { supported: true, enabled: true },
      provideDocumentSymbols: { supported: true, enabled: false },
      provideHover: { supported: true, enabled: true },
      provideReferences: { supported: true, enabled: true },
      provideRenameEdits: { supported: true, enabled: true }
    });
    expect(resolved.custom).toEqual({
      'apexoas/gatherContext': { supported: true, enabled: true },
      'apexoas/isEligible': { supported: true, enabled: true },
      'debugger/exceptionBreakpoints': { supported: true, enabled: true },
      'debugger/lineBreakpoints': { supported: true, enabled: true },
      'test/getTestMethods': { supported: true, enabled: true }
    });
  });

  it('applies an individual override without changing other capability states', () => {
    const resolved = resolveLanguageServerCapabilities({
      custom: { 'apexoas/isEligible': false },
      lsp: { provideDocumentSymbols: true }
    });

    expect(resolved.lsp.provideDocumentSymbols.enabled).toBe(true);
    expect(resolved.custom['apexoas/isEligible'].enabled).toBe(false);
    expect(resolved.custom['apexoas/gatherContext'].enabled).toBe(true);
  });

  it('does not mutate its policy input', () => {
    const policy = { custom: { 'debugger/lineBreakpoints': false } };

    resolveLanguageServerCapabilities(policy);

    expect(policy).toEqual({ custom: { 'debugger/lineBreakpoints': false } });
  });
});
