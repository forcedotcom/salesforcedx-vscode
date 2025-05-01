/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import vscode, { DocumentSymbol, Uri } from 'vscode';
export type ApexClassOASEligibleRequest = {
  resourceUri: Uri;
  includeAllMethods: boolean;
  includeAllProperties: boolean;
  position: vscode.Position | null;
  methodNames: string[] | null;
  propertyNames: string[] | null;
};

interface SymbolEligibility {
  isEligible: boolean;
  isApexOasEligible: boolean;
  docSymbol: DocumentSymbol;
}

export type ApexClassOASEligibleResponse = {
  isEligible: boolean;
  isApexOasEligible: boolean;
  resourceUri: Uri;
  symbols?: SymbolEligibility[];
};

export type ApexOASEligiblePayload = {
  payload: ApexClassOASEligibleRequest[];
};
export type ApexClassOASEligibleResponses = ApexClassOASEligibleResponse[];

export type ApexClassOASGatherContextResponse = {
  classDetail: ApexOASClassDetail;
  properties: ApexOASPropertyDetail[];
  methods: ApexOASMethodDetail[];
  relationships: Map<string, Map<string, string[]>>; // Map<methodName, Map<srcClassUri, List<methodOrPropName>>>
};

export type ApexAnnotationDetail = {
  name: string;
  parameters: {
    [key: string]: string;
  };
};

export type ApexOASClassDetail = {
  name: string;
  interfaces: ApexOASInterface[];
  extendedClass: ApexOASClassDetail | null;
  annotations: ApexAnnotationDetail[];
  definitionModifiers: string[];
  accessModifiers: string[];
  innerClasses: DocumentSymbol[];
  comment: string;
};

type ApexOASPropertyDetail = {
  name: string;
  type: string;
  documentSymbol: DocumentSymbol;
  modifiers: string[];
  annotations: ApexAnnotationDetail[];
  comment: string;
};

export type ApexOASMethodDetail = {
  name: string;
  returnType: string;
  parameterTypes: string[];
  modifiers: string[];
  annotations: ApexAnnotationDetail[];
  comment: string;
};

type ApexOASInterface = {
  name: string;
  uri: string;
  methods: DocumentSymbol[];
};

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

export interface OpenAPIDoc {
  openapi: string;
  servers?: { url: string }[];
  info: { title: string; version: string; description: string };
  paths: Record<string, any>;
  components?: { schemas?: Record<string, any> };
}

export interface Prompts {
  SYSTEM_TAG: string;
  END_OF_PROMPT_TAG: string;
  USER_TAG: string;
  ASSISTANT_TAG: string;
  systemPrompt: string;
  METHOD_BY_METHOD: {
    USER_PROMPT: string;
  };
  wholeClass: {
    userPrompt: string;
  };
}

export enum HttpRequestMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE'
}

export const httpMethodMap = new Map<string, string>([
  ['HttpGet', 'get'],
  ['HttpPost', 'post'],
  ['HttpPut', 'put'],
  ['HttpPatch', 'patch'],
  ['HttpDelete', 'delete']
]);

export type OASGenerationCommandProperties = {
  isClass: string;
  overwrite: string;
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
