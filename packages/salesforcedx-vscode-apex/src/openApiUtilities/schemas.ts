/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import vscode, { DocumentSymbol } from 'vscode';
export type ApexClassOASEligibleRequest = {
  resourceUri: string;
  includeAllMethods: boolean;
  includeAllProperties: boolean;
  position: vscode.Position | null;
  methodNames: string[] | null;
  propertyNames: string[] | null;
};

export interface SymbolEligibility {
  isEligible: boolean;
  isApexOasEligible: boolean;
  docSymbol: DocumentSymbol;
}

export type ApexClassOASEligibleResponse = {
  isEligible: boolean;
  isApexOasEligible: boolean;
  resourceUri: string;
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
  documentations: Map<string, string[]>; // Map<method/prop/class name, each line of documentation>
};

export type ApexOASClassDetail = {
  name: string;
  interfaces: ApexOASInterface[];
  extendedClass: ApexOASClassDetail | null;
  annotations: string[];
  definitionModifiers: string[];
  accessModifiers: string[];
  innerClasses: DocumentSymbol[];
};

export type ApexOASPropertyDetail = {
  name: string;
  type: string;
  documentSymbol: DocumentSymbol;
  modifiers: string[];
  annotations: string[];
};

export type ApexOASMethodDetail = {
  name: string;
  returnType: string;
  parameterTypes: string[];
  modifiers: string[];
  annotations: string[];
};

export type ApexOASInterface = {
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

export type PromptGenerationResult = {
  callCounts: number;
  maxBudget: number;
};

export type PromptGenerationStrategyBid = {
  strategy: string;
  result: PromptGenerationResult;
};
