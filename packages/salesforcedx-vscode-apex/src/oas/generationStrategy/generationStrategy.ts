/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LLMServiceInterface, ServiceProvider, ServiceType } from '@salesforce/vscode-service-provider';
import * as vscode from 'vscode';
import { APEX_OAS_INCLUDE_GUIDED_JSON, SF_LOG_LEVEL_SETTING } from '../../constants';
import {
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  PromptGenerationResult,
  PromptGenerationStrategyBid
} from '../schemas';
import { openAPISchema_v3_0 } from './openapi-3.schema';

export abstract class GenerationStrategy {
  abstract metadata: ApexClassOASEligibleResponse;
  abstract context: ApexClassOASGatherContextResponse;
  abstract strategyName: string;
  abstract callCounts: number;
  abstract maxBudget: number;
  abstract bid(): PromptGenerationStrategyBid;
  abstract generate(): PromptGenerationResult; // generate the prompt(s) to be sent to the LLM
  abstract callLLMWithPrompts(): Promise<string[]>;
  abstract generateOAS(): Promise<string>; // generate OAS with the generated prompt(s)
  openAPISchema: string;
  includeOASSchema: boolean | undefined;
  logLevel: string;

  constructor() {
    this.openAPISchema = JSON.stringify(openAPISchema_v3_0, undefined, 2);
    this.includeOASSchema = undefined;
    this.logLevel = vscode.workspace.getConfiguration().get(SF_LOG_LEVEL_SETTING, 'fatal');
  }

  getPromptTokenCount(prompt: string): number {
    return Math.floor(prompt.length / 4);
  }

  getLLMServiceInterface = async (): Promise<LLMServiceInterface> => {
    return ServiceProvider.getService(ServiceType.LLMService, 'salesforcedx-vscode-apex');
  };

  protected includesOASSchema(): boolean {
    return vscode.workspace.getConfiguration().get(APEX_OAS_INCLUDE_GUIDED_JSON, true);
  }
}
