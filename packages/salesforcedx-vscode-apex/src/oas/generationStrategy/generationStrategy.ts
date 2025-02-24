/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LLMServiceInterface, ServiceProvider, ServiceType } from '@salesforce/vscode-service-provider';
import * as vscode from 'vscode';
import { APEX_OAS_INCLUDE_GUIDED_JSON, APEX_OAS_OUTPUT_TOKEN_LIMIT, SF_LOG_LEVEL_SETTING } from '../../constants';
import {
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  PromptGenerationResult,
  PromptGenerationStrategyBid
} from '../schemas';

// Below import has to be required for bundling
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
const AsyncLock = require('async-lock');
export abstract class GenerationStrategy {
  abstract metadata: ApexClassOASEligibleResponse;
  abstract context: ApexClassOASGatherContextResponse;
  abstract strategyName: string;
  abstract biddedCallCount: number;
  abstract maxBudget: number;
  abstract bid(): PromptGenerationStrategyBid;
  abstract generate(): PromptGenerationResult; // generate the prompt(s) to be sent to the LLM
  abstract callLLMWithPrompts(): Promise<string[]>;
  abstract generateOAS(): Promise<string>; // generate OAS with the generated prompt(s)
  abstract openAPISchema: string | undefined;
  includeOASSchema: boolean | undefined;
  logLevel: string;
  outputTokenLimit: number;
  llmCallCount: number;

  private lock = new AsyncLock();

  constructor() {
    this.includeOASSchema = undefined;
    this.logLevel = vscode.workspace.getConfiguration().get(SF_LOG_LEVEL_SETTING, 'fatal');
    this.outputTokenLimit = vscode.workspace.getConfiguration().get(APEX_OAS_OUTPUT_TOKEN_LIMIT, 750);
    this.llmCallCount = 0;
  }

  getPromptTokenCount(prompt: string): number {
    return Math.floor(prompt.length / 4);
  }

  getLLMServiceInterface = async (): Promise<LLMServiceInterface> => {
    return ServiceProvider.getService(ServiceType.LLMService, 'salesforcedx-vscode-apex');
  };

  async incrementCallCount(): Promise<void> {
    await this.lock.acquire(this.strategyName, () => this.llmCallCount++);
  }

  protected includesOASSchema(): boolean {
    this.includeOASSchema = vscode.workspace.getConfiguration().get(APEX_OAS_INCLUDE_GUIDED_JSON, true);
    return this.includeOASSchema;
  }
}
