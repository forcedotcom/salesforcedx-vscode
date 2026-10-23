/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { resolveLanguageServerCapabilities, type CapabilityPolicy } from '../../src/languageServerCapabilities';

const productionPolicy: CapabilityPolicy = {
  lsp: {
    provideCodeActions: true,
    provideCodeLenses: true,
    provideCompletions: true,
    provideDefinition: true,
    provideDocumentSymbols: false,
    provideHover: true,
    provideReferences: true,
    provideRenameEdits: true
  }
};

describe('resolveLanguageServerCapabilities', () => {
  it('matches the current Jorje production capability baseline', () => {
    const resolved = resolveLanguageServerCapabilities(productionPolicy);

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
  });

  it('resolves every capability from its explicit setting state', () => {
    const resolved = resolveLanguageServerCapabilities({
      ...productionPolicy,
      lsp: { ...productionPolicy.lsp, provideDocumentSymbols: true }
    });

    expect(resolved.lsp.provideDocumentSymbols.enabled).toBe(true);
  });

  it('does not mutate its policy input', () => {
    const policy = { ...productionPolicy, lsp: { ...productionPolicy.lsp, provideHover: false } };
    const originalPolicy = structuredClone(policy);

    resolveLanguageServerCapabilities(policy);

    expect(policy).toEqual(originalPolicy);
  });
});
