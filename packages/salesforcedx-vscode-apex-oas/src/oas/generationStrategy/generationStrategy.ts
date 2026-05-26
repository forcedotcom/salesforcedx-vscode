/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LLMServiceInterface, ServiceProvider, ServiceType } from '@salesforce/vscode-service-provider';
import * as vscode from 'vscode';
import { APEX_OAS_OUTPUT_TOKEN_LIMIT } from '../../constants';
import { PromptGenerationStrategyBid } from '../schemas';

export type StrategyTelemetry = {
  strategyName: string;
  biddedCallCount: number;
  llmCallCount: number;
  generationSize: number;
  outputTokenLimit?: number;
  // TODO: Remove this once we have a proper way to include the OAS schema
  // guidedJson should be wired to vscode.workspace.getConfiguration().get(APEX_OAS_INCLUDE_GUIDED_JSON, false)
  guidedJson?: string;
};

export type GenerationStrategy = {
  readonly strategyName: string;
  readonly betaInfo?: string;
  readonly openAPISchema: string | undefined;
  bid: () => Promise<PromptGenerationStrategyBid>;
  generateOAS: () => Promise<string>;
  getTelemetry: () => StrategyTelemetry;
};

export const getPromptTokenCount = (prompt: string): number => Math.floor(prompt.length / 4);

export const getLLMServiceInterface = (): Promise<LLMServiceInterface> =>
  ServiceProvider.getService(ServiceType.LLMService, 'salesforcedx-vscode-apex-oas');

export const getOutputTokenLimit = (): number =>
  vscode.workspace.getConfiguration().get(APEX_OAS_OUTPUT_TOKEN_LIMIT, 750);
