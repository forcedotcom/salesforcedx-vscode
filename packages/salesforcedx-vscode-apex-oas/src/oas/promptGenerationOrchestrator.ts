/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import { isNotUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import type { ApexClassOASEligibleResponse, ApexClassOASGatherContextResponse } from 'salesforcedx-vscode-apex';
import { nls } from '../messages/nls';
import { GenerationStrategyType, initializeAndBid } from './generationStrategy/generationStrategyFactory';
import { PromptGenerationStrategyBid } from './schemas';

/** @ExportTaggedError */
export class StrategyNotQualified extends Data.TaggedError('StrategyNotQualified')<{
  readonly message: string;
}> {}

const BidRule = Schema.Literal('LEAST_CALLS', 'MOST_CALLS');
export type BidRule = typeof BidRule.Type;

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

const getBidRule = Effect.fn('ApexOas.Strategy.getBidRule')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const current = yield* (yield* api.services.SettingsService).getValue(
    'salesforcedx-vscode-apex-oas',
    'generation_strategy'
  );
  return yield* Schema.decodeUnknown(BidRule)(current).pipe(Effect.orElseSucceed((): BidRule => 'LEAST_CALLS'));
});

export const selectStrategyByBidRule = Effect.fn('ApexOas.Strategy.bid')(function* (
  metadata: ApexClassOASEligibleResponse,
  context: ApexClassOASGatherContextResponse
) {
  const [{ strategies, bids }, rule] = yield* Effect.all([
    initializeAndBid(metadata, context).pipe(
      Effect.mapError(
        cause => new StrategyNotQualified({ message: `Strategy initialization failed: ${String(cause)}` })
      )
    ),
    getBidRule()
  ]);
  return yield* applyRule(rule, bids).pipe(
    Effect.map(type => strategies.get(type)),
    Effect.filterOrFail(
      isNotUndefined,
      () => new StrategyNotQualified({ message: nls.localize('strategy_not_qualified') })
    )
  );
});
