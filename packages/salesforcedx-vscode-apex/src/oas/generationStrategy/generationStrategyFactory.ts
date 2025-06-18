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
import { ApexRestStrategy } from './json/apexRest';
import { AuraEnabledStrategy } from './json/auraEnabledStrategy';

export type GenerationStrategyType = 'ApexRest' | 'AuraEnabled';

export type StrategyTypes = ApexRestStrategy | AuraEnabledStrategy;

export const initializeAndBid = async (
  metadata: ApexClassOASEligibleResponse,
  context: ApexClassOASGatherContextResponse
): Promise<{
  strategies: Map<GenerationStrategyType, StrategyTypes>;
  bids: Map<GenerationStrategyType, PromptGenerationStrategyBid>;
}> => {
  // Initialize strategies
  const strategies = new Map<GenerationStrategyType, StrategyTypes>();
  strategies.set('ApexRest', new ApexRestStrategy(metadata, context));
  strategies.set('AuraEnabled', new AuraEnabledStrategy(metadata, context));

  // Get bids from all strategies
  const bidPromises = Array.from(strategies.entries())
    .filter(([_, strategy]) => strategy)
    .map(
      async ([strategyName, strategy]): Promise<[GenerationStrategyType, PromptGenerationStrategyBid]> => [
        strategyName,
        await strategy.bid()
      ]
    );

  const bidResults = await Promise.all(bidPromises);
  const bids = new Map(bidResults);

  return { strategies, bids };
};
