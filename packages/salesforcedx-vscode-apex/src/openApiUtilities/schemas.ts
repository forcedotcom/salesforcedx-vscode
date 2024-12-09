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

export enum ApexOASResource {
  class = 'CLASS',
  multiClass = 'MULTI CLASSES',
  singleMethodOrProp = 'METHOD or PROPERTY',
  folder = 'FOLDER'
}
// export interface ApexClassOASFilter {
//   modifiers: string[] | null;
// }

// export interface ApexMethodOASFilter {
//   annotations: string[] | null;
//   modifiers: string[] | null;
// }

// export interface ApexPropertyOASFilter {
//   annotations: string[] | null;
//   modifiers: string[] | null;
// }

// export type Filter = {
//   class: ApexClassOASFilter;
//   method: ApexMethodOASFilter;
//   property: ApexPropertyOASFilter;
// };
