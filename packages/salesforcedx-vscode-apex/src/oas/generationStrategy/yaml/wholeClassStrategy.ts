/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import { PROMPT_TOKEN_MAX_LIMIT, IMPOSED_FACTOR, SUM_TOKEN_MAX_LIMIT } from '..';
import { nls } from '../../../messages';
import GenerationInteractionLogger from '../../generationInteractionLogger';
import {
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  PromptGenerationResult,
  PromptGenerationStrategyBid
} from '../../schemas';
import { GenerationStrategy } from '../generationStrategy';
import { getPrompts } from '../promptsHandler';

const gil = GenerationInteractionLogger.getInstance();

export const WHOLE_CLASS_STRATEGY_NAME = 'WholeClass';
export class WholeClassStrategy extends GenerationStrategy {
  metadata: ApexClassOASEligibleResponse;
  context: ApexClassOASGatherContextResponse;
  prompts: string[];
  strategyName: string;
  biddedCallCount: number;
  maxBudget: number;
  llmResponses: string[];
  openAPISchema: string | undefined;

  public constructor(metadata: ApexClassOASEligibleResponse, context: ApexClassOASGatherContextResponse) {
    super();
    this.metadata = metadata;
    this.context = context;
    this.prompts = [];
    this.strategyName = WHOLE_CLASS_STRATEGY_NAME;
    this.biddedCallCount = 0;
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
    const prompts = getPrompts();
    const documentText = fs.readFileSync(this.metadata.resourceUri.fsPath, 'utf8');
    const input =
      `${prompts.SYSTEM_TAG}\n${prompts.systemPrompt}\n${prompts.END_OF_PROMPT_TAG}\n${prompts.USER_TAG}\n` +
      prompts.wholeClass.userPrompt +
      '\nThis is the Apex class the OpenAPI v3 specification should be generated for:\n```\n' +
      documentText +
      `\nClass name: ${this.context.classDetail.name}, methods: ${this.context.methods.map(method => method.name).join(', ')}\n` +
      `\n\`\`\`\n${prompts.END_OF_PROMPT_TAG}\n${prompts.ASSISTANT_TAG}\n`;
    const tokenCount = this.getPromptTokenCount(input);
    if (tokenCount <= PROMPT_TOKEN_MAX_LIMIT * IMPOSED_FACTOR) {
      this.prompts.push(input);
      this.biddedCallCount++;
      return {
        maxBudget: Math.floor((SUM_TOKEN_MAX_LIMIT - tokenCount) * IMPOSED_FACTOR),
        callCounts: this.biddedCallCount
      };
    } else {
      return {
        maxBudget: 0,
        callCounts: 0
      };
    }
  }

  async callLLMWithPrompts(): Promise<string[]> {
    let documentContent = '';
    try {
      const llmService = await this.getLLMServiceInterface();
      gil.addPrompt(this.prompts[0]);
      documentContent = await llmService.callLLM(this.prompts[0]);
      gil.addRawResponse(documentContent);
      this.llmResponses.push(documentContent);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      throw new Error(errorMessage);
    }
    return this.llmResponses;
  }

  async generateOAS(): Promise<string> {
    const oas = await this.callLLMWithPrompts();
    if (oas.length > 0 && oas[0]) {
      return oas[0];
    }
    throw new Error(nls.localize('llm_bad_response'));
  }
}
