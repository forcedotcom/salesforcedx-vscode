/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DocumentSymbol, Position } from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';

interface ApexOASSymbolEligibility {
  isEligible: boolean;
  isApexOasEligible: boolean;
  docSymbol: DocumentSymbol;
}

export type ApexClassOASEligibleRequest = {
  resourceUri: URI;
  includeAllMethods: boolean;
  includeAllProperties: boolean;
  methodNames: string[];
  position: Position | null;
  propertyNames: string[];
};

export type ApexClassOASEligibleResponse = {
  resourceUri: URI;
  isApexOasEligible: boolean;
  isEligible: boolean;
  symbols?: ApexOASSymbolEligibility[];
};

export type ApexClassOASEligibleResponses = ApexClassOASEligibleResponse[];

export type ApexOASEligiblePayload = {
  payload: ApexClassOASEligibleRequest[];
};

/** Apex class detail for OAS generation */
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

export type ApexOASPropertyDetail = {
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

export type ApexOASInterface = {
  name: string;
  uri: string;
  methods: DocumentSymbol[];
};

export type ApexAnnotationDetail = {
  name: string;
  parameters: {
    [key: string]: string;
  };
};

export type ApexClassOASGatherContextResponse = {
  // Define the structure based on what the language server returns
  [key: string]: any;
};
