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

/** A non-standard Jorje request that a client can suppress before dispatch. */
export type CustomEndpoint =
  | 'apexoas/gatherContext'
  | 'apexoas/isEligible'
  | 'debugger/exceptionBreakpoints'
  | 'debugger/lineBreakpoints'
  | 'test/getTestMethods';

/** A non-standard Jorje notification consumed internally by the client. */
export type ServerNotification = 'indexer/done';

/** Per-item overrides applied to the production capability baseline for one client lifetime. */
export type CapabilityPolicy = Readonly<{
  lsp?: Readonly<Partial<Record<LspFeature, boolean>>>;
  custom?: Readonly<Partial<Record<CustomEndpoint, boolean>>>;
}>;

/** The resolved availability of one inventory item. `supported` means Jorje implements it. */
type FeatureState = Readonly<{
  supported: boolean;
  enabled: boolean;
}>;

const productionCapabilities = {
  lsp: {
    provideCodeActions: true,
    provideCodeLenses: true,
    provideCompletions: true,
    provideDefinition: true,
    provideDocumentSymbols: false,
    provideHover: true,
    provideReferences: true,
    provideRenameEdits: true
  },
  custom: {
    'apexoas/gatherContext': true,
    'apexoas/isEligible': true,
    'debugger/exceptionBreakpoints': true,
    'debugger/lineBreakpoints': true,
    'test/getTestMethods': true
  },
  notifications: {
    'indexer/done': true
  }
} as const satisfies Readonly<{
  lsp: Record<LspFeature, boolean>;
  custom: Record<CustomEndpoint, boolean>;
  notifications: Record<ServerNotification, boolean>;
}>;

const resolveFeature = (enabled: boolean): FeatureState => ({ supported: true, enabled });

/** Immutable LSP-provider, custom-request, and notification states captured when an Apex Language Client starts. */
export type ResolvedLanguageServerCapabilities = Readonly<{
  lsp: Readonly<Record<LspFeature, FeatureState>>;
  custom: Readonly<Record<CustomEndpoint, FeatureState>>;
  notifications: Readonly<Record<ServerNotification, FeatureState>>;
}>;

/** Hidden VS Code setting suffixes for individual capability opt-outs. `true` disables the item. */
export const capabilitySettings = {
  lsp: {
    provideCodeActions: 'advanced.capabilities.disableCodeActions',
    provideCodeLenses: 'advanced.capabilities.disableCodeLenses',
    provideCompletions: 'advanced.capabilities.disableCompletions',
    provideDefinition: 'advanced.capabilities.disableDefinition',
    provideDocumentSymbols: 'advanced.capabilities.disableDocumentSymbols',
    provideHover: 'advanced.capabilities.disableHover',
    provideReferences: 'advanced.capabilities.disableReferences',
    provideRenameEdits: 'advanced.capabilities.disableRenameEdits'
  },
  custom: {
    'apexoas/gatherContext': 'advanced.capabilities.disableApexoasGatherContext',
    'apexoas/isEligible': 'advanced.capabilities.disableApexoasIsEligible',
    'debugger/exceptionBreakpoints': 'advanced.capabilities.disableDebuggerExceptionBreakpoints',
    'debugger/lineBreakpoints': 'advanced.capabilities.disableDebuggerLineBreakpoints',
    'test/getTestMethods': 'advanced.capabilities.disableTestGetTestMethods'
  }
} as const satisfies Readonly<{
  lsp: Record<LspFeature, string>;
  custom: Record<CustomEndpoint, string>;
}>;

/** Resolves the Jorje production baseline with optional individual feature overrides. */
export const resolveLanguageServerCapabilities = (
  policy: CapabilityPolicy = {}
): ResolvedLanguageServerCapabilities => ({
  lsp: {
    provideCodeActions: resolveFeature(policy.lsp?.provideCodeActions ?? productionCapabilities.lsp.provideCodeActions),
    provideCodeLenses: resolveFeature(policy.lsp?.provideCodeLenses ?? productionCapabilities.lsp.provideCodeLenses),
    provideCompletions: resolveFeature(policy.lsp?.provideCompletions ?? productionCapabilities.lsp.provideCompletions),
    provideDefinition: resolveFeature(policy.lsp?.provideDefinition ?? productionCapabilities.lsp.provideDefinition),
    provideDocumentSymbols: resolveFeature(
      policy.lsp?.provideDocumentSymbols ?? productionCapabilities.lsp.provideDocumentSymbols
    ),
    provideHover: resolveFeature(policy.lsp?.provideHover ?? productionCapabilities.lsp.provideHover),
    provideReferences: resolveFeature(policy.lsp?.provideReferences ?? productionCapabilities.lsp.provideReferences),
    provideRenameEdits: resolveFeature(policy.lsp?.provideRenameEdits ?? productionCapabilities.lsp.provideRenameEdits)
  },
  custom: {
    'apexoas/gatherContext': resolveFeature(
      policy.custom?.['apexoas/gatherContext'] ?? productionCapabilities.custom['apexoas/gatherContext']
    ),
    'apexoas/isEligible': resolveFeature(
      policy.custom?.['apexoas/isEligible'] ?? productionCapabilities.custom['apexoas/isEligible']
    ),
    'debugger/exceptionBreakpoints': resolveFeature(
      policy.custom?.['debugger/exceptionBreakpoints'] ?? productionCapabilities.custom['debugger/exceptionBreakpoints']
    ),
    'debugger/lineBreakpoints': resolveFeature(
      policy.custom?.['debugger/lineBreakpoints'] ?? productionCapabilities.custom['debugger/lineBreakpoints']
    ),
    'test/getTestMethods': resolveFeature(
      policy.custom?.['test/getTestMethods'] ?? productionCapabilities.custom['test/getTestMethods']
    )
  },
  notifications: {
    'indexer/done': resolveFeature(productionCapabilities.notifications['indexer/done'])
  }
});
