/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { nls } from '../messages';
import { cleanupGeneratedDoc } from '../oasUtils';
import GenerationInteractionLogger from './generationInteractionLogger';
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

export type BidRule = 'LEAST_CALLS' | 'MOST_CALLS' | 'JSON_METHOD_BY_METHOD';

const gil = GenerationInteractionLogger.getInstance();

// An orchestrator that coordinates the generation of prompts for Apex classes.
export class PromptGenerationOrchestrator {
  metadata: ApexClassOASEligibleResponse;
  context: ApexClassOASGatherContextResponse;
  strategies: Map<GenerationStrategy, Strategy>;
  strategy: Strategy | undefined = undefined;
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
    this.strategy = this.strategies.get(bestStrategy);
    if (!this.strategy) {
      throw new Error(nls.localize('strategy_not_qualified'));
    }
    const oas = await this.strategy.generateOAS().then(o => cleanupGeneratedDoc(o));
    gil.addPostGenDoc(oas);
    gil.addGenerationStrategy(rule);
    gil.addOutputTokenLimit(this.strategy.outputTokenLimit);
    if (this.strategy.includeOASSchema && this.strategy.openAPISchema) {
      gil.addGuidedJson(this.strategy.openAPISchema);
    }
    return oas;
  }

  // Apply a specific rule to select the name of the best strategy from the list of bids.
  applyRule(rule: BidRule, bids: Map<GenerationStrategy, PromptGenerationStrategyBid>): GenerationStrategy {
    // preserve the options for other strategies.  See code history for what this used to point to
    switch (rule) {
      case 'LEAST_CALLS':
        return this.getJsonMethodByMethod(bids);
      case 'MOST_CALLS':
        return this.getJsonMethodByMethod(bids);
      case 'JSON_METHOD_BY_METHOD':
        return this.getJsonMethodByMethod(bids);
    }
  }

  getJsonMethodByMethod(bids: Map<GenerationStrategy, PromptGenerationStrategyBid>): GenerationStrategy {
    return GenerationStrategy.JSON_METHOD_BY_METHOD;
  }
}
