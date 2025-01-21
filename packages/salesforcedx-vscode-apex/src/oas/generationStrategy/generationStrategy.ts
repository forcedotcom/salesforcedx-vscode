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

export abstract class GenerationStrategy {
  abstract metadata: ApexClassOASEligibleResponse;
  abstract context: ApexClassOASGatherContextResponse;
  abstract prompts: string[];
  abstract strategyName: string;
  abstract callCounts: number;
  abstract maxBudget: number;
  abstract bid(): PromptGenerationStrategyBid;
  abstract generate(): PromptGenerationResult;
  getPromptTokenCount(prompt: string): number {
    return Math.floor(prompt.length / 4);
  }
}
