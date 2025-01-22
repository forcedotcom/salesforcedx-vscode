/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import {
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  PromptGenerationResult,
  PromptGenerationStrategyBid
} from '../../openApiUtilities/schemas';
import { IMPOSED_FACTOR, PROMPT_TOKEN_MAX_LIMIT, SUM_TOKEN_MAX_LIMIT } from '.';
import { GenerationStrategy } from './generationStrategy';
import prompts from './prompts.json';
export const WHOLE_CLASS_STRATEGY_NAME = 'WholeClass';
export class WholeClassStrategy extends GenerationStrategy {
  metadata: ApexClassOASEligibleResponse;
  context: ApexClassOASGatherContextResponse;
  prompts: string[];
  strategyName: string;
  callCounts: number;
  maxBudget: number;
  llmResponses: string[];

  public constructor(metadata: ApexClassOASEligibleResponse, context: ApexClassOASGatherContextResponse) {
    super();
    this.metadata = metadata;
    this.context = context;
    this.prompts = [];
    this.strategyName = WHOLE_CLASS_STRATEGY_NAME;
    this.callCounts = 0;
    this.maxBudget = 0;
    this.llmResponses = [];
  }

  public bid(): PromptGenerationStrategyBid {
    const generationResult = this.generate();
    return {
      result: generationResult
    };
  }

  public generate(): PromptGenerationResult {
    const documentText = fs.readFileSync(new URL(this.metadata.resourceUri.toString()), 'utf8');
    const input =
      `${prompts.SYSTEM_TAG}\n${prompts.systemPrompt}\n${prompts.END_OF_PROMPT_TAG}\n${prompts.USER_TAG}\n` +
      prompts['WHOLE_CLASS.USER_PROMPT'] +
      '\nThis is the Apex class the OpenAPI v3 specification should be generated for:\n```\n' +
      documentText +
      `\nClass name: ${this.context.classDetail.name}, methods: ${this.context.methods.map(method => method.name).join(', ')}\n` +
      `\n\`\`\`\n${prompts.END_OF_PROMPT_TAG}\n${prompts.ASSISTANT_TAG}\n`;
    const tokenCount = this.getPromptTokenCount(input);
    if (tokenCount <= PROMPT_TOKEN_MAX_LIMIT * IMPOSED_FACTOR) {
      this.prompts.push(input);
      this.callCounts++;
      return {
        maxBudget: Math.floor((SUM_TOKEN_MAX_LIMIT - tokenCount) * IMPOSED_FACTOR),
        callCounts: this.callCounts
      };
    } else {
      return {
        maxBudget: 0,
        callCounts: 0
      };
    }
  }

  public async callLLMWithGivenPrompts(): Promise<string[]> {
    let documentContent = '';
    try {
      const llmService = await this.getLLMServiceInterface();
      documentContent = await llmService.callLLM(this.prompts[0]);
      this.llmResponses.push(documentContent);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      throw new Error(errorMessage);
    }
    return this.llmResponses;
  }

  public async saveOasAsErsMetadata(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
