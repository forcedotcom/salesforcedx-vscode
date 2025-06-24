/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { GenerationStrategy } from './generationStrategy/generationStrategy';
import { nls } from '../messages';
import { cleanupGeneratedDoc } from '../oasUtils';
import GenerationInteractionLogger from './generationInteractionLogger';
import {
  type GenerationStrategyType,
  initializeAndBid,
  type StrategyTypes
} from './generationStrategy/generationStrategyFactory';
import {
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  PromptGenerationStrategyBid
} from './schemas';

export const BID_RULES = {
  LEAST_CALLS: 'LEAST_CALLS',
  MOST_CALLS: 'MOST_CALLS'
} as const;

export type BidRule = keyof typeof BID_RULES;

const gil = GenerationInteractionLogger.getInstance();

// An orchestrator that coordinates the generation of prompts for Apex classes.
export class PromptGenerationOrchestrator {
  private metadata: ApexClassOASEligibleResponse;
  private context: ApexClassOASGatherContextResponse;
  private strategies: Map<GenerationStrategyType, StrategyTypes>;
  public strategy: GenerationStrategy | undefined = undefined;
  // The orchestrator is initialized with metadata and context.
  constructor(metadata: ApexClassOASEligibleResponse, context: ApexClassOASGatherContextResponse) {
    this.metadata = metadata;
    this.context = context;
    this.strategies = new Map<GenerationStrategyType, StrategyTypes>();
  }

  // Initialize strategies and get their bids in one step
  private async initializeAndBid(): Promise<Map<GenerationStrategyType, PromptGenerationStrategyBid>> {
    const { strategies, bids } = await initializeAndBid(this.metadata, this.context);
    this.strategies = strategies;
    return bids;
  }

  // Selects and sets the strategy based on the bid rule
  public async selectStrategyByBidRule(rule: BidRule): Promise<GenerationStrategy> {
    const bids = await this.initializeAndBid();
    const selectedStrategyType = this.applyRule(rule, bids);
    if (!selectedStrategyType) {
      throw new Error(nls.localize('strategy_not_qualified'));
    }
    this.strategy = this.strategies.get(selectedStrategyType);
    if (!this.strategy) {
      throw new Error(nls.localize('strategy_not_qualified'));
    }
    return this.strategy;
  }

  // Generates the OAS using the previously selected strategy
  public async generateOASWithSelectedStrategy(rule?: BidRule): Promise<string> {
    if (!this.strategy) {
      if (rule) {
        await this.selectStrategyByBidRule(rule);
      } else {
        throw new Error(nls.localize('strategy_not_qualified'));
      }
    }
    const oas = await this.strategy!.generateOAS().then(o => cleanupGeneratedDoc(o));
    gil.addPostGenDoc(oas);
    gil.addGenerationStrategy(rule ?? 'MANUAL');
    gil.addOutputTokenLimit(this.strategy!.outputTokenLimit);
    if (this.strategy!.includeOASSchema && this.strategy!.openAPISchema) {
      gil.addGuidedJson(this.strategy!.openAPISchema);
    }
    return oas;
  }

  // Apply a specific rule to select the name of the best strategy from the list of bids.
  private applyRule(
    rule: BidRule,
    bids: Map<GenerationStrategyType, PromptGenerationStrategyBid>
  ): GenerationStrategyType | undefined {
    switch (rule) {
      case BID_RULES.LEAST_CALLS:
        return this.getLeastCallsStrategy(bids);
      case BID_RULES.MOST_CALLS:
        return this.getMostCallsStrategy(bids);
      default:
        throw new Error(nls.localize('unknown_bid_rule', rule));
    }
  }

  private getLeastCallsStrategy(
    bids: Map<GenerationStrategyType, PromptGenerationStrategyBid>
  ): GenerationStrategyType | undefined {
    const validBids = Array.from(bids.entries()).map(([strategy, bid]) => ({
      strategy,
      bid,
      callCount: bid.result.callCounts
    }));

    const validBidsWithCalls = validBids.filter(bid => bid.callCount > 0);
    if (validBidsWithCalls.length === 0) {
      return undefined;
    }
    const bestBid = validBidsWithCalls.reduce((best, current) => (current.callCount < best.callCount ? current : best));
    return bestBid.strategy;
  }

  private getMostCallsStrategy(
    bids: Map<GenerationStrategyType, PromptGenerationStrategyBid>
  ): GenerationStrategyType | undefined {
    const validBids = Array.from(bids.entries())
      .filter(([_, bid]) => bid.result.callCounts > 0)
      .map(([strategy, bid]) => ({
        strategy,
        bid,
        callCount: bid.result.callCounts
      }));

    if (validBids.length === 0) {
      return undefined;
    }

    const validBidsWithCalls = validBids.filter(bid => bid.callCount > 0);
    if (validBidsWithCalls.length === 0) {
      return undefined;
    }
    const bestBid = validBidsWithCalls.reduce((best, current) => (current.callCount > best.callCount ? current : best));
    return bestBid.strategy;
  }
}
