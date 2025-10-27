/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DocumentSymbol } from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';

export type ApexClassOASEligibleRequest = {
  resourceUri: URI;
  selectedMethod?: string;
};

export type ApexClassOASEligibleResponse = {
  resourceUri: URI;
  isApexOasEligible: boolean;
  isEligible: boolean;
  symbols?: DocumentSymbol[];
};

export type ApexClassOASEligibleResponses = ApexClassOASEligibleResponse[];

export type ApexOASEligiblePayload = {
  payload: ApexClassOASEligibleRequest[];
};

export type ApexClassOASGatherContextResponse = {
  // Define the structure based on what the language server returns
  [key: string]: any;
};
