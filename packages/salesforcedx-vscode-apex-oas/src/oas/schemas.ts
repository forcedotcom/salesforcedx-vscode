/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Re-export all OAS types from the Apex extension - no duplication!
export type {
  ApexClassOASEligibleRequest,
  ApexClassOASEligibleResponse,
  ApexClassOASEligibleResponses,
  ApexOASEligiblePayload,
  ApexClassOASGatherContextResponse,
  ApexOASSymbolEligibility,
  ApexOASClassDetail,
  ApexOASPropertyDetail,
  ApexOASMethodDetail,
  ApexOASInterface,
  ApexAnnotationDetail
} from 'salesforcedx-vscode-apex';

export enum ApexOASResource {
  class = 'CLASS',
  multiClass = 'MULTI CLASSES',
  singleMethodOrProp = 'METHOD or PROPERTY',
  folder = 'FOLDER'
}

export type ApexOASInfo = {
  description: string;
};

export type ExternalServiceOperation = {
  name: string;
  active: boolean;
};

export type PromptGenerationResult = {
  callCounts: number;
  maxBudget: number;
};

// to be populated with more discussed metrics
export type PromptGenerationStrategyBid = {
  result: PromptGenerationResult;
};

export type HttpRequestMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export const httpMethodMap: Record<string, HttpRequestMethod> = {
  HttpGet: 'get',
  HttpPost: 'post',
  HttpPut: 'put',
  HttpPatch: 'patch',
  HttpDelete: 'delete'
} as const;

export type OASGenerationCommandProperties = {
  isClass: string;
  overwrite: string;
  strategy: string;
};

export type OASGenerationCommandMeasure = {
  llmCallCount?: number;
  biddedCallCount?: number;
  generationSize?: number;
  generationDuration?: number;
  documentTtlProblems?: number;
  documentErrors?: number;
  documentWarnings?: number;
  documentInfo?: number;
  documentHints?: number;
};
