/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Public API type declarations for salesforcedx-vscode-apex.
 * Used so dependent packages (apex-debugger, apex-replay-debugger, apex-oas) resolve types
 * without relying on build output (out/), fixing GHA compile when wireit runs in parallel.
 */

import type { DocumentSymbol, Position } from 'vscode-languageserver-protocol';
import type { URI } from 'vscode-uri';

// --- Language client status (consumed by debuggers / OAS) ---
export interface LanguageClientStatusLike {
  isReady(): boolean;
  isIndexing(): boolean;
  failedToInitialize(): boolean;
  getStatusMessage(): string;
}

export interface LanguageClientManagerLike {
  getClientInstance(): unknown;
  getStatus(): LanguageClientStatusLike;
  getLineBreakpointInfo(): Promise<unknown[]>;
  getApexTests(): Promise<unknown[]>;
}

// --- ApexVSCodeApi (extension exports) ---
export interface ApexVSCodeApi {
  getLineBreakpointInfo: () => Promise<unknown[]>;
  getExceptionBreakpointInfo: () => Promise<unknown[]>;
  getApexTests: () => Promise<unknown[]>;
  languageClientManager: LanguageClientManagerLike;
}

// --- LanguageClientManager (class type for apex-oas) ---
export interface LanguageClientManager extends LanguageClientManagerLike {}

// --- OAS schema types (consumed by apex-oas) ---
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
  symbols?: Array<{
    isEligible: boolean;
    isApexOasEligible: boolean;
    docSymbol: DocumentSymbol;
  }>;
};

export type ApexClassOASEligibleResponses = ApexClassOASEligibleResponse[];

export type ApexOASEligiblePayload = {
  payload: ApexClassOASEligibleRequest[];
};

export type ApexClassOASGatherContextResponse = {
  [key: string]: unknown;
};

export type ApexAnnotationDetail = {
  name: string;
  parameters: { [key: string]: string };
};

export type ApexOASInterface = {
  name: string;
  uri: string;
  methods: DocumentSymbol[];
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
