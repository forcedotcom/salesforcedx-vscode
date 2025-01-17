/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  PromptGenerationStrategyBid
} from '../openApiUtilities/schemas';
import { GenerationStrategy } from './generationStrategy/generationStrategy';
import { GenerationStrategyFactory } from './generationStrategy/generationStrategyFactory';

enum BidRule {
  LEAST_CALLS,
  MAX_RESPONSE_TOKENS
}

export class PromptGenerationOrchestrator {
  metadata: ApexClassOASEligibleResponse;
  context: ApexClassOASGatherContextResponse;
  strategies: GenerationStrategy[];
  constructor(metadata: ApexClassOASEligibleResponse, context: ApexClassOASGatherContextResponse) {
    this.metadata = metadata;
    this.context = context;
    this.strategies = [];
  }

  public initializeStrategyBidder() {
    this.strategies = GenerationStrategyFactory.initializeAllStrategies(this.metadata, this.context);
  }

  public bid(): PromptGenerationStrategyBid[] {
    const bids = this.strategies.map(strategy => strategy.bid());
    return bids;
  }

  applyRule(rule: BidRule, bids: PromptGenerationStrategyBid[]): string {
    switch (rule) {
      case BidRule.LEAST_CALLS:
        return this.getLeastCalls(bids);
      case BidRule.MAX_RESPONSE_TOKENS:
        return this.getMaxResponseTokens(bids);
    }
  }

  getLeastCalls(bids: PromptGenerationStrategyBid[]): string {
    return bids
      .filter(bid => bid.result.callCounts > 0)
      .reduce((prev, current) => {
        return prev.result.callCounts < current.result.callCounts ? prev : current;
      }).strategy;
  }

  getMaxResponseTokens(bids: PromptGenerationStrategyBid[]): string {
    return bids
      .filter(bid => bid.result.callCounts > 0)
      .reduce((prev, current) => {
        return prev.result.maxBudget > current.result.maxBudget ? prev : current;
      }).strategy;
  }
}
