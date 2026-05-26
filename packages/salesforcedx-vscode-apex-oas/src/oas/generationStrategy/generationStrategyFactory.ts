/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  PromptGenerationStrategyBid
} from '../schemas';
import { GenerationStrategy } from './generationStrategy';
import { createApexRestStrategy } from './json/apexRest';
import { createAuraEnabledStrategy } from './json/auraEnabledStrategy';

export type GenerationStrategyType = 'ApexRest' | 'AuraEnabled';

export const initializeAndBid = async (
  metadata: ApexClassOASEligibleResponse,
  context: ApexClassOASGatherContextResponse
): Promise<{
  strategies: Map<GenerationStrategyType, GenerationStrategy>;
  bids: Map<GenerationStrategyType, PromptGenerationStrategyBid>;
}> => {
  // Initialize strategies
  const strategies = new Map<GenerationStrategyType, GenerationStrategy>();
  const apexRestStrategy = await createApexRestStrategy(metadata, context);
  const auraEnabledStrategy = await createAuraEnabledStrategy(context);

  strategies.set('ApexRest', apexRestStrategy);
  strategies.set('AuraEnabled', auraEnabledStrategy);

  // Get bids from all strategies
  const bidPromises = Array.from(strategies.entries()).map(
    async ([strategyName, strategy]): Promise<[GenerationStrategyType, PromptGenerationStrategyBid]> => [
      strategyName,
      await strategy.bid()
    ]
  );

  const bidResults = await Promise.all(bidPromises);
  const bids = new Map(bidResults);

  return { strategies, bids };
};
