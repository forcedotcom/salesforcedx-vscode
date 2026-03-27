/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * 1:1 with Jorje `new TelemetryData("…")` feature names in apex-jorje-lsp (main sources, not tests).
 * When Jorje adds or renames a feature, update {@link JORJE_LSP_TELEMETRY_FEATURES_FROM_SOURCE} and
 * classify it in {@link BLOCKED_APEX_LSP_TELEMETRY_FEATURES} or let it flow into {@link ALLOWED_APEX_LSP_TELEMETRY_FEATURES}.
 *
 * {@link BLOCKED_APEX_LSP_TELEMETRY_FEATURES}: per-request / high-volume paths (hover, completion strategies, document lifecycle, etc.).
 * {@link ALLOWED_APEX_LSP_TELEMETRY_FEATURES}: derived as (all Jorje features minus blocked) plus legacy aliases seen in telemetry.
 */
export const JORJE_LSP_TELEMETRY_FEATURES_FROM_SOURCE = [
  'Apex-Completions',
  'ApexDefinitionStrategyAggregator',
  'ApexDebuggerService',
  'ApexIndexer',
  'ApexIndexer-handleDidChange',
  'ApexLanguageServer',
  'ApexLanguageServerLauncher',
  'ApexOASEligibility',
  'ApexOASGatherContext',
  'ApexReferenceStrategyAggregator',
  'ApexPrelude-SourceFilesCollector',
  'ApexPrelude-startup',
  'CodeAction',
  'CodeActionsProviderAggregator',
  'CodeLens',
  'CodeLensesProviderAggregator',
  'Completion',
  'Deadlock-Detected',
  'Definition',
  'DocumentLifecycleDispatcher',
  'EmbeddedSoqlCompletionStrategy',
  'ExtractConstantHandler',
  'ExtractLocalVariableHandler',
  'FieldRenameHandler',
  'Hover',
  'LocalVariableNamesCompletionStrategy',
  'MembersCompletionStrategy',
  'MethodNamesCompletionStrategy',
  'MethodRenameHandler',
  'Modifiers',
  'NamesCompletionStrategies',
  'NdApexIndex',
  'References',
  'Rename',
  'SfdxProjects',
  'StandardHoverProvider',
  'StandardRenameProvider',
  'StandardSymbolsDefinitionStrategy',
  'StandardTestService',
  'SObjectFieldNamesCompletionStrategy',
  'SystemNamespaceCompletionStrategy',
  'TrackedUsageReferenceStrategy',
  'TriggerContextVariablesCompletionStrategy',
  'TriggerKeywordCompletionStrategy',
  'TypeDefinitionWriter',
  'TypesCompletionStrategy',
  'Typings',
  'WorkspaceChangeListenerDispatcher'
] as const;

/** Feature strings not present in current Jorje source but observed in telemetry (older/alternate builds). */
export const JORJE_LSP_TELEMETRY_LEGACY_FEATURE_ALIASES = ['ApexIndexer-Startup'] as const;

/**
 * Per-request or completion-strategy telemetry — omit from App Insights `apexLSPLog` volume.
 * Must be disjoint from {@link ALLOWED_APEX_LSP_TELEMETRY_FEATURES}.
 */
export const BLOCKED_APEX_LSP_TELEMETRY_FEATURES: ReadonlySet<string> = new Set([
  'Apex-Completions',
  'ApexDefinitionStrategyAggregator',
  'ApexIndexer-handleDidChange',
  'ApexReferenceStrategyAggregator',
  'CodeAction',
  'CodeActionsProviderAggregator',
  'CodeLens',
  'CodeLensesProviderAggregator',
  'Completion',
  'Definition',
  'DocumentLifecycleDispatcher',
  'EmbeddedSoqlCompletionStrategy',
  'ExtractConstantHandler',
  'ExtractLocalVariableHandler',
  'FieldRenameHandler',
  'Hover',
  'LocalVariableNamesCompletionStrategy',
  'MembersCompletionStrategy',
  'MethodNamesCompletionStrategy',
  'MethodRenameHandler',
  'Modifiers',
  'NamesCompletionStrategies',
  'References',
  'Rename',
  'StandardHoverProvider',
  'StandardRenameProvider',
  'StandardSymbolsDefinitionStrategy',
  'SObjectFieldNamesCompletionStrategy',
  'SystemNamespaceCompletionStrategy',
  'TrackedUsageReferenceStrategy',
  'TriggerContextVariablesCompletionStrategy',
  'TriggerKeywordCompletionStrategy',
  'TypesCompletionStrategy'
]);

const allowedFromJorje = JORJE_LSP_TELEMETRY_FEATURES_FROM_SOURCE.filter(
  f => !BLOCKED_APEX_LSP_TELEMETRY_FEATURES.has(f)
);

export const ALLOWED_APEX_LSP_TELEMETRY_FEATURES: ReadonlySet<string> = new Set([
  ...allowedFromJorje,
  ...JORJE_LSP_TELEMETRY_LEGACY_FEATURE_ALIASES
]);

export const isApexLspTelemetryAllowed = (properties: Record<string, string> | undefined): boolean => {
  const feature = properties?.Feature;
  return typeof feature === 'string' && ALLOWED_APEX_LSP_TELEMETRY_FEATURES.has(feature);
};
