/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import type { ApexClassOASEligibleResponse, ApexClassOASGatherContextResponse } from 'salesforcedx-vscode-apex';
import * as vscode from 'vscode';
import { nls } from '../messages/nls';
import { GenerationStrategyType, initializeAndBid } from './generationStrategy/generationStrategyFactory';
import { PromptGenerationStrategyBid } from './schemas';

/** @ExportTaggedError */
export class StrategyNotQualified extends Data.TaggedError('StrategyNotQualified')<{
  readonly message: string;
}> {}

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

const isBidRule = (value: unknown): value is BidRule => value === 'LEAST_CALLS' || value === 'MOST_CALLS';

const getBidRule = (): BidRule => {
  const currentBidRule = vscode.workspace
    .getConfiguration()
    .get<BidRule>('salesforcedx-vscode-apex-oas.generation_strategy', 'LEAST_CALLS');
  return isBidRule(currentBidRule) ? currentBidRule : 'LEAST_CALLS';
};

export const selectStrategyByBidRule = Effect.fn('ApexOas.Strategy.bid')(function* (
  metadata: ApexClassOASEligibleResponse,
  context: ApexClassOASGatherContextResponse
) {
  const { strategies, bids } = yield* initializeAndBid(metadata, context).pipe(
    Effect.mapError(cause => new StrategyNotQualified({ message: `Strategy initialization failed: ${String(cause)}` }))
  );
  const selectedStrategyType = yield* applyRule(getBidRule(), bids);
  const strategy = strategies.get(selectedStrategyType);
  return strategy ?? (yield* new StrategyNotQualified({ message: nls.localize('strategy_not_qualified') }));
});
