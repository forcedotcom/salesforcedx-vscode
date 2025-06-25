/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LLMServiceInterface, ServiceProvider, ServiceType } from '@salesforce/vscode-service-provider';
import * as vscode from 'vscode';
import { APEX_OAS_INCLUDE_GUIDED_JSON, APEX_OAS_OUTPUT_TOKEN_LIMIT } from '../../constants';
import {
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  PromptGenerationStrategyBid
} from '../schemas';

// Below import has to be required for bundling
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
const AsyncLock = require('async-lock');

export abstract class GenerationStrategy {
  public metadata: ApexClassOASEligibleResponse;
  public context: ApexClassOASGatherContextResponse;
  public biddedCallCount: number;
  public maxBudget: number;
  public includeOASSchema: boolean | undefined;
  public outputTokenLimit: number;
  public resolutionAttempts: number;
  public strategyName: string;

  protected serviceRequests: Map<string, Promise<string>> = new Map();
  protected serviceResponses: Map<string, string> = new Map();
  protected servicePrompts: Map<string, string> = new Map();
  protected sourceText: string = '';
  protected classPrompt: string = '';
  protected oasSchema: string = '';

  private beta: string | undefined;

  public abstract bid(): Promise<PromptGenerationStrategyBid>;
  public abstract generateOAS(): Promise<string>; // generate OAS with the resolved content
  public abstract openAPISchema: string | undefined;

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
    this.outputTokenLimit = vscode.workspace.getConfiguration().get(APEX_OAS_OUTPUT_TOKEN_LIMIT, 750);
    this.resolutionAttempts = 0;
    this.beta = betaInfo;
  }

  protected getPromptTokenCount(prompt: string): number {
    return Math.floor(prompt.length / 4);
  }

  public getLLMServiceInterface = async (): Promise<LLMServiceInterface> =>
    ServiceProvider.getService(ServiceType.LLMService, 'salesforcedx-vscode-apex');

  public async incrementResolutionAttempts(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await this.lock.acquire(this.strategyName, () => this.resolutionAttempts++);
  }

  protected includesOASSchema(): boolean {
    this.includeOASSchema = vscode.workspace.getConfiguration().get(APEX_OAS_INCLUDE_GUIDED_JSON, true);
    return this.includeOASSchema;
  }

  public get betaInfo(): string | undefined {
    return this.beta;
  }
}
