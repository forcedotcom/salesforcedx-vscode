/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  PromptGenerationResult,
  PromptGenerationStrategyBid
} from '../../openApiUtilities/schemas';
import { IMPOSED_FACTOR, PROMPT_TOKEN_MAX_LIMIT, RESPONSE_TOKEN_MAX_LIMIT, SUM_TOKEN_MAX_LIMIT } from '.';
import { GenerationStrategy } from './generationStrategy';

export const METHOD_BY_METHOD_STRATEGY_NAME = 'MethodByMethod';
export class MethodByMethodStrategy extends GenerationStrategy {
  metadata: ApexClassOASEligibleResponse;
  context: ApexClassOASGatherContextResponse;
  prompts: string[];
  strategyName: string;
  callCounts: number;
  maxBudget: number;
  methodsList: string[];

  public constructor(metadata: ApexClassOASEligibleResponse, context: ApexClassOASGatherContextResponse) {
    super();
    this.metadata = metadata;
    this.context = context;
    this.prompts = [];
    this.strategyName = 'MethodByMethod';
    this.callCounts = 0;
    this.maxBudget = SUM_TOKEN_MAX_LIMIT * IMPOSED_FACTOR;
    this.methodsList = [];
  }

  public bid(): PromptGenerationStrategyBid {
    const generationResult = this.generate();
    return {
      strategy: this.strategyName,
      result: generationResult
    };
  }
  public generate(): PromptGenerationResult {
    const methodsMap = new Map();
    for (const symbol of (this.metadata.symbols ?? []).filter(symbol => symbol.isApexOasEligible)) {
      if (symbol.isApexOasEligible) {
        const methodName = symbol.docSymbol.name;
        methodsMap.set(methodName, symbol.docSymbol); // docSymbol might be useful for generating prompts
        const input = this.generatePromptForMethod(methodName);
        const tokenCount = this.getPromptTokenCount(input);
        if (tokenCount <= PROMPT_TOKEN_MAX_LIMIT * IMPOSED_FACTOR) {
          this.prompts.push(input);
          this.callCounts++;
          const currentBudget = Math.floor((PROMPT_TOKEN_MAX_LIMIT - tokenCount) * IMPOSED_FACTOR);
          if (currentBudget < this.maxBudget) {
            this.maxBudget = currentBudget;
          }
        } else {
          // as long as there is one failure, the strategy will be considered failed
          this.prompts = [];
          this.callCounts = 0;
          this.maxBudget = 0;
          return {
            maxBudget: 0,
            callCounts: 0
          };
        }
      }
    }
    return {
      maxBudget: this.maxBudget,
      callCounts: this.callCounts
    };
  }

  generatePromptForMethod(methodName: string): string {
    return 'to be fine tuned';
  }
}
