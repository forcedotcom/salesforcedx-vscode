/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { nls } from '../messages';
import {
  GenerationStrategy,
  GenerationStrategyFactory,
  Strategy
} from './generationStrategy/generationStrategyFactory';
import {
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  PromptGenerationStrategyBid
} from './schemas';

export enum BidRule {
  LEAST_CALLS,
  MOST_CALLS,
  METHOD_BY_METHOD
}

// An orchestrator that coordinates the generation of prompts for Apex classes.
export class PromptGenerationOrchestrator {
  metadata: ApexClassOASEligibleResponse;
  context: ApexClassOASGatherContextResponse;
  strategies: Map<GenerationStrategy, Strategy>;
  // The orchestrator is initialized with metadata and context.
  constructor(metadata: ApexClassOASEligibleResponse, context: ApexClassOASGatherContextResponse) {
    this.metadata = metadata;
    this.context = context;
    this.strategies = new Map<GenerationStrategy, Strategy>();
    this.initializeStrategyBidder();
  }

  // Initialize all available strategies with the provided metadata and context.
  initializeStrategyBidder() {
    this.strategies = GenerationStrategyFactory.initializeAllStrategies(this.metadata, this.context);
  }

  // Make each strategy bid on the given class information and return a list of bids.
  public bid(): Map<GenerationStrategy, PromptGenerationStrategyBid> {
    const bids = new Map<GenerationStrategy, PromptGenerationStrategyBid>();
    for (const strategyName of this.strategies.keys()) {
      const strategy = this.strategies.get(strategyName);
      if (strategy) {
        bids.set(strategyName, strategy.bid());
      }
    }
    return bids;
  }

  // after best strategy is determined, call the LLM with the selected strategy and return the result.
  public async generateOASWithStrategySelectedByBidRule(rule: BidRule): Promise<string> {
    const bids = this.bid();
    const bestStrategy = this.applyRule(rule, bids);
    const strategy = this.strategies.get(bestStrategy);
    if (!strategy) {
      throw new Error(nls.localize('strategy_not_qualified'));
    }
    const oas = await strategy.generateOAS();
    return this.cleanupYaml(oas);
  }

  // Apply a specific rule to select the name of the best strategy from the list of bids.
  applyRule(rule: BidRule, bids: Map<GenerationStrategy, PromptGenerationStrategyBid>): GenerationStrategy {
    switch (rule) {
      case BidRule.LEAST_CALLS:
        return this.getLeastCalls(bids);
      case BidRule.MOST_CALLS:
        return this.getMostCalls(bids);
      case BidRule.METHOD_BY_METHOD:
        return this.getMethodByMethod(bids);
    }
  }

  getLeastCalls(bids: Map<GenerationStrategy, PromptGenerationStrategyBid>): GenerationStrategy {
    let maxCallCount = 0;
    let bestStrategy: GenerationStrategy = GenerationStrategy.METHOD_BY_METHOD; // fallback
    for (const strategyName of bids.keys()) {
      const bid = bids.get(strategyName);
      if (bid && bid.result.callCounts > 0) {
        if (maxCallCount === 0 || bid.result.callCounts > maxCallCount) {
          maxCallCount = bid.result.callCounts;
          bestStrategy = strategyName;
        }
      }
    }
    // TODO: define which to pick when both strategies have same call counts
    return GenerationStrategy.METHOD_BY_METHOD; // METHOD_BY_METHOD is the default strategy
  }

  getMostCalls(bids: Map<GenerationStrategy, PromptGenerationStrategyBid>): GenerationStrategy {
    let maxCallCount = 0;
    let bestStrategy: GenerationStrategy = GenerationStrategy.METHOD_BY_METHOD; // fallback
    for (const strategyName of bids.keys()) {
      const bid = bids.get(strategyName);
      if (bid && bid.result.callCounts > 0) {
        if (maxCallCount === 0 || bid.result.callCounts > maxCallCount) {
          maxCallCount = bid.result.callCounts;
          bestStrategy = strategyName;
        }
      }
    }
    return GenerationStrategy.METHOD_BY_METHOD;
  }

  getMethodByMethod(bids: Map<GenerationStrategy, PromptGenerationStrategyBid>): GenerationStrategy {
    return GenerationStrategy.METHOD_BY_METHOD;
  }

  private cleanupYaml(doc: string): string {
    // Remove the first line of the document
    const openApiIndex = doc.indexOf('openapi');
    if (openApiIndex === -1) {
      throw new Error(nls.localize('cleanup_yaml_failed') + doc);
    }
    return doc
      .substring(openApiIndex)
      .split('\n')
      .filter(line => !/^```$/.test(line))
      .join('\n');
  }
}
