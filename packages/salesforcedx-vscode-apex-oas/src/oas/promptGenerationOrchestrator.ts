/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { nls } from '../messages/nls';
import { cleanupGeneratedDoc } from '../oasUtils';
import GenerationInteractionLogger from './generationInteractionLogger';
import { GenerationStrategy } from './generationStrategy/generationStrategy';
import { type GenerationStrategyType, initializeAndBid } from './generationStrategy/generationStrategyFactory';
import {
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  PromptGenerationStrategyBid
} from './schemas';

export type BidRule = 'LEAST_CALLS' | 'MOST_CALLS';

const gil = GenerationInteractionLogger.getInstance();

// Apply a specific rule to select the name of the best strategy from the list of bids.
export const getLeastCallsStrategy = (
  bids: Map<GenerationStrategyType, PromptGenerationStrategyBid>
): GenerationStrategyType | undefined => {
  const validBids = Array.from(bids.entries())
    .map(([strategy, bid]) => ({ strategy, callCount: bid.result.callCounts }))
    .filter(b => b.callCount > 0);
  if (validBids.length === 0) return undefined;
  return validBids.reduce((best, current) => (current.callCount < best.callCount ? current : best)).strategy;
};

export const getMostCallsStrategy = (
  bids: Map<GenerationStrategyType, PromptGenerationStrategyBid>
): GenerationStrategyType | undefined => {
  const validBids = Array.from(bids.entries())
    .map(([strategy, bid]) => ({ strategy, callCount: bid.result.callCounts }))
    .filter(b => b.callCount > 0);
  if (validBids.length === 0) return undefined;
  return validBids.reduce((best, current) => (current.callCount > best.callCount ? current : best)).strategy;
};

export const applyRule = (
  rule: BidRule,
  bids: Map<GenerationStrategyType, PromptGenerationStrategyBid>
): GenerationStrategyType | undefined => {
  switch (rule) {
    case 'LEAST_CALLS':
      return getLeastCallsStrategy(bids);
    case 'MOST_CALLS':
      return getMostCallsStrategy(bids);
    default:
      throw new Error(nls.localize('unknown_bid_rule', rule));
  }
};

// An orchestrator that coordinates the generation of prompts for Apex classes.
export class PromptGenerationOrchestrator {
  private metadata: ApexClassOASEligibleResponse;
  private context: ApexClassOASGatherContextResponse;
  private strategies: Map<GenerationStrategyType, GenerationStrategy>;
  public strategy: GenerationStrategy | undefined = undefined;

  // The orchestrator is initialized with metadata and context.
  constructor(metadata: ApexClassOASEligibleResponse, context: ApexClassOASGatherContextResponse) {
    this.metadata = metadata;
    this.context = context;
    this.strategies = new Map<GenerationStrategyType, GenerationStrategy>();
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
    const selectedStrategyType = applyRule(rule, bids);
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
    const telemetry = this.strategy!.getTelemetry();
    if (telemetry.outputTokenLimit !== undefined) {
      gil.addOutputTokenLimit(telemetry.outputTokenLimit);
    }
    if (telemetry.guidedJson) {
      gil.addGuidedJson(telemetry.guidedJson);
    }
    return oas;
  }
}
