/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LLMServiceInterface, ServiceProvider, ServiceType } from '@salesforce/vscode-service-provider';
import {
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  PromptGenerationResult,
  PromptGenerationStrategyBid
} from '../schemas';

export abstract class GenerationStrategy {
  abstract metadata: ApexClassOASEligibleResponse;
  abstract context: ApexClassOASGatherContextResponse;
  abstract prompts: string[] | Map<string, string>; // Map<methodName, prompt>
  abstract strategyName: string;
  abstract callCounts: number;
  abstract maxBudget: number;
  abstract llmResponses: string[] | Map<string, string>; // Map<methodName, yaml response>
  abstract bid(): PromptGenerationStrategyBid;
  abstract generate(): PromptGenerationResult; // generate the prompt(s) to be sent to the LLM
  abstract callLLMWithPrompts(): Promise<string[]>;
  abstract generateOAS(): Promise<string>; // generate OAS with the generated prompt(s)
  getPromptTokenCount(prompt: string): number {
    return Math.floor(prompt.length / 4);
  }

  getLLMServiceInterface = async (): Promise<LLMServiceInterface> => {
    return ServiceProvider.getService(ServiceType.LLMService, 'salesforcedx-vscode-apex');
  };
}
