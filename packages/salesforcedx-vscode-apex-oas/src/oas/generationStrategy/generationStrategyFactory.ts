/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { ApexClassOASEligibleResponse, ApexClassOASGatherContextResponse } from '../schemas';
import { GenerationStrategy } from './generationStrategy';
import { createApexRestStrategy } from './json/apexRest';
import { createAuraEnabledStrategy } from './json/auraEnabledStrategy';

export type GenerationStrategyType = 'ApexRest' | 'AuraEnabled';

export const initializeAndBid = Effect.fn('ApexOas.Strategy.initializeAndBid')(function* (
  metadata: ApexClassOASEligibleResponse,
  context: ApexClassOASGatherContextResponse
) {
  // Initialize strategies
  const apexRestStrategy = yield* createApexRestStrategy(metadata, context);
  const auraEnabledStrategy = yield* Effect.promise(() => createAuraEnabledStrategy(context));
  const strategies = new Map<GenerationStrategyType, GenerationStrategy>([
    ['ApexRest', apexRestStrategy],
    ['AuraEnabled', auraEnabledStrategy]
  ]);
  // Get bids from all strategies
  const bidEntries = yield* Effect.forEach(
    Array.from(strategies.entries()),
    ([name, strategy]) => Effect.map(strategy.bid(), bid => [name, bid] as const),
    { concurrency: 'unbounded' }
  );
  return { strategies, bids: new Map(bidEntries) };
});
