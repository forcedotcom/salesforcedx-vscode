/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { LLMCallFailed, LLMRetriesExhausted, MethodNotFoundInDocSymbols, OasGenerationFailed } from '../../errors';
import type { LLMService } from '../../services/llmService';
import type { PromptGenerationStrategyBid } from '../schemas';
import type { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type * as Effect from 'effect/Effect';
import type { ConnectionService } from 'salesforcedx-vscode-services';

export type StrategyTelemetry = {
  biddedCallCount: number;
  llmCallCount: number;
  generationSize: number;
  outputTokenLimit?: number;
  // TODO: Remove this once we have a proper way to include the OAS schema
  // guidedJson should be wired to vscode.workspace.getConfiguration().get(APEX_OAS_INCLUDE_GUIDED_JSON, false)
  guidedJson?: string;
};

export type GenerationStrategy = {
  readonly strategyName: string;
  readonly openAPISchema: string | undefined;
  bid: () => Effect.Effect<PromptGenerationStrategyBid, never, never>;
  generateOAS: () => Effect.Effect<
    string,
    OasGenerationFailed | LLMRetriesExhausted | LLMCallFailed | MethodNotFoundInDocSymbols,
    LLMService | ExtensionProviderService | ConnectionService
  >;
  getTelemetry: () => StrategyTelemetry;
};
