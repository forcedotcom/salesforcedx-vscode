/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable barrel-files/avoid-barrel-files -- intentional re-export of upstream Apex types alongside locally-defined types */

// Re-export all OAS types from the Apex extension - no duplication!
export type {
  ApexClassOASEligibleRequest,
  ApexClassOASEligibleResponse,
  ApexOASEligiblePayload,
  ApexClassOASGatherContextResponse,
  ApexOASClassDetail,
  ApexOASMethodDetail,
  ApexAnnotationDetail
} from 'salesforcedx-vscode-apex';

export type ApexOASResource = 'CLASS' | 'MULTI CLASSES' | 'METHOD or PROPERTY' | 'FOLDER';

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
