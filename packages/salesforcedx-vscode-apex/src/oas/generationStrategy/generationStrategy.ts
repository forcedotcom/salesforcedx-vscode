/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { readFile } from '@salesforce/salesforcedx-utils-vscode';
import { LLMServiceInterface, ServiceProvider, ServiceType } from '@salesforce/vscode-service-provider';
import * as vscode from 'vscode';
import { APEX_OAS_INCLUDE_GUIDED_JSON, APEX_OAS_OUTPUT_TOKEN_LIMIT, SF_LOG_LEVEL_SETTING } from '../../constants';
import {
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  PromptGenerationStrategyBid
} from '../schemas';

// Below import has to be required for bundling
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
const AsyncLock = require('async-lock');

export abstract class GenerationStrategy {
  metadata: ApexClassOASEligibleResponse;
  context: ApexClassOASGatherContextResponse;
  strategyName: string;
  biddedCallCount: number;
  maxBudget: number;
  serviceRequests: Map<string, Promise<string>> = new Map();
  serviceResponses: Map<string, string> = new Map();
  servicePrompts: Map<string, string> = new Map();
  sourceText: string = '';
  classPrompt: string = '';
  oasSchema: string = '';
  abstract bid(): Promise<PromptGenerationStrategyBid>;
  abstract generateOAS(): Promise<string>; // generate OAS with the resolved content
  abstract openAPISchema: string | undefined;
  includeOASSchema: boolean | undefined;
  logLevel: string;
  outputTokenLimit: number;
  resolutionAttempts: number;
  beta: string | undefined;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  private lock = new AsyncLock();

  constructor(
    metadata: ApexClassOASEligibleResponse,
    context: ApexClassOASGatherContextResponse,
    strategyName: string,
    biddedCallCount: number,
    maxBudget: number,
    betaInfo?: string
  ) {
    this.metadata = metadata;
    this.context = context;
    this.strategyName = strategyName;
    this.biddedCallCount = biddedCallCount;
    this.maxBudget = maxBudget;
    this.includeOASSchema = undefined;
    this.logLevel = vscode.workspace.getConfiguration().get(SF_LOG_LEVEL_SETTING, 'fatal');
    this.outputTokenLimit = vscode.workspace.getConfiguration().get(APEX_OAS_OUTPUT_TOKEN_LIMIT, 750);
    this.resolutionAttempts = 0;
    this.beta = betaInfo;
  }

  async initialize(): Promise<void> {
    this.sourceText = await readFile(this.metadata.resourceUri.fsPath);
  }
  getPromptTokenCount(prompt: string): number {
    return Math.floor(prompt.length / 4);
  }

  getLLMServiceInterface = async (): Promise<LLMServiceInterface> =>
    ServiceProvider.getService(ServiceType.LLMService, 'salesforcedx-vscode-apex');

  async incrementResolutionAttempts(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await this.lock.acquire(this.strategyName, () => this.resolutionAttempts++);
  }

  protected includesOASSchema(): boolean {
    this.includeOASSchema = vscode.workspace.getConfiguration().get(APEX_OAS_INCLUDE_GUIDED_JSON, true);
    return this.includeOASSchema;
  }

  get betaInfo(): string | undefined {
    return this.beta;
  }
}
