/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/** A standard LSP provider advertised by Jorje during initialization. */
export type LspFeature =
  | 'provideCodeActions'
  | 'provideCodeLenses'
  | 'provideCompletions'
  | 'provideDefinition'
  | 'provideDocumentSymbols'
  | 'provideHover'
  | 'provideReferences'
  | 'provideRenameEdits';

/** A user-selected state for a configurable Jorje capability. */
export type CapabilitySetting = 'enabled' | 'disabled';

/** Complete user-selected states captured when an Apex Language Client starts. */
export type CapabilityPolicy = Readonly<{
  lsp: Readonly<Record<LspFeature, boolean>>;
}>;

/** The resolved availability of one inventory item. `supported` means Jorje implements it. */
type FeatureState = Readonly<{
  supported: boolean;
  enabled: boolean;
}>;

const resolveFeature = (enabled: boolean): FeatureState => ({ supported: true, enabled });

/** Immutable LSP-provider states captured when an Apex Language Client starts. */
export type ResolvedLanguageServerCapabilities = Readonly<{
  lsp: Readonly<Record<LspFeature, FeatureState>>;
}>;

/** VS Code setting suffixes for individual Jorje capability states. */
export const capabilitySettings = {
  lsp: {
    provideCodeActions: 'advanced.capabilities.codeActions',
    provideCodeLenses: 'advanced.capabilities.codeLenses',
    provideCompletions: 'advanced.capabilities.completions',
    provideDefinition: 'advanced.capabilities.definition',
    provideDocumentSymbols: 'advanced.capabilities.documentSymbols',
    provideHover: 'advanced.capabilities.hover',
    provideReferences: 'advanced.capabilities.references',
    provideRenameEdits: 'advanced.capabilities.renameEdits'
  }
} as const satisfies Readonly<{
  lsp: Record<LspFeature, string>;
}>;

/** Resolves the user-selected settings into Jorje client capability states. */
export const resolveLanguageServerCapabilities = (policy: CapabilityPolicy): ResolvedLanguageServerCapabilities => ({
  lsp: {
    provideCodeActions: resolveFeature(policy.lsp.provideCodeActions),
    provideCodeLenses: resolveFeature(policy.lsp.provideCodeLenses),
    provideCompletions: resolveFeature(policy.lsp.provideCompletions),
    provideDefinition: resolveFeature(policy.lsp.provideDefinition),
    provideDocumentSymbols: resolveFeature(policy.lsp.provideDocumentSymbols),
    provideHover: resolveFeature(policy.lsp.provideHover),
    provideReferences: resolveFeature(policy.lsp.provideReferences),
    provideRenameEdits: resolveFeature(policy.lsp.provideRenameEdits)
  }
});
