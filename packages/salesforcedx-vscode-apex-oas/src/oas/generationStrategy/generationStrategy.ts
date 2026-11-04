/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type {
  LLMCallFailed,
  LLMConnectionFailed,
  LLMRateLimited,
  LLMRetriesExhausted,
  MethodNotFoundInDocSymbols,
  OasGenerationFailed
} from '../../errors';
import type { LLMService } from '../../services/llmService';
import type { PromptGenerationStrategyBid } from '../schemas';
import type { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type * as Effect from 'effect/Effect';
import type { ConnectionService } from 'salesforcedx-vscode-services';

export type GenerationStrategy = {
  bid: () => Effect.Effect<PromptGenerationStrategyBid, never, never>;
  generateOAS: () => Effect.Effect<
    string,
    | OasGenerationFailed
    | LLMRetriesExhausted
    | LLMCallFailed
    | LLMRateLimited
    | LLMConnectionFailed
    | MethodNotFoundInDocSymbols,
    LLMService | ExtensionProviderService | ConnectionService
  >;
};
