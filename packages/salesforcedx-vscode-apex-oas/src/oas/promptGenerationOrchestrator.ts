/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import { StrategyNotQualified } from '../errors';
import { nls } from '../messages/nls';
import { GenerationStrategy } from './generationStrategy/generationStrategy';
import { GenerationStrategyType, initializeAndBid } from './generationStrategy/generationStrategyFactory';
import {
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  PromptGenerationStrategyBid
} from './schemas';

export type BidRule = 'LEAST_CALLS' | 'MOST_CALLS';

const validBidsByCount = (bids: Map<GenerationStrategyType, PromptGenerationStrategyBid>) =>
  Array.from(bids.entries())
    .map(([strategy, bid]) => ({ strategy, callCount: bid.result.callCounts }))
    .filter(b => b.callCount > 0);

export const getLeastCallsStrategy = Effect.fn('ApexOas.Strategy.leastCalls')(function* (
  bids: Map<GenerationStrategyType, PromptGenerationStrategyBid>
) {
  const validBids = validBidsByCount(bids);
  return validBids.length === 0
    ? yield* new StrategyNotQualified({ message: nls.localize('strategy_not_qualified') })
    : validBids.reduce((best, current) => (current.callCount < best.callCount ? current : best)).strategy;
});

export const getMostCallsStrategy = Effect.fn('ApexOas.Strategy.mostCalls')(function* (
  bids: Map<GenerationStrategyType, PromptGenerationStrategyBid>
) {
  const validBids = validBidsByCount(bids);
  return validBids.length === 0
    ? yield* new StrategyNotQualified({ message: nls.localize('strategy_not_qualified') })
    : validBids.reduce((best, current) => (current.callCount > best.callCount ? current : best)).strategy;
});

export const applyRule = (rule: BidRule, bids: Map<GenerationStrategyType, PromptGenerationStrategyBid>) => {
  switch (rule) {
    case 'LEAST_CALLS':
      return getLeastCallsStrategy(bids);
    case 'MOST_CALLS':
      return getMostCallsStrategy(bids);
  }
};

export const selectStrategyByBidRule = Effect.fn('ApexOas.Strategy.bid')(function* (
  metadata: ApexClassOASEligibleResponse,
  context: ApexClassOASGatherContextResponse,
  rule: BidRule
) {
  const { strategies, bids } = yield* initializeAndBid(metadata, context).pipe(
    Effect.mapError(cause => new StrategyNotQualified({ message: `Strategy initialization failed: ${String(cause)}` }))
  );
  const selectedStrategyType = yield* applyRule(rule, bids);
  const strategy: GenerationStrategy | undefined = strategies.get(selectedStrategyType);
  return strategy ?? (yield* new StrategyNotQualified({ message: nls.localize('strategy_not_qualified') }));
});
