/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SObjectShortDescription } from '../describe/types';
import { SObject } from './describe';

export type SObjectCategory = 'ALL' | 'STANDARD' | 'CUSTOM';

export type SObjectRefreshSource = 'manual' | 'startup' | 'startupmin';

export type FieldDeclaration = {
  modifier: string;
  type: string;
  name: string;
  comment?: string;
};

export type SObjectDefinition = Pick<SObject, 'name'> & {
  fields: FieldDeclaration[];
};

export type SObjectDefinitionRetriever = {
  retrieve: (output: SObjectRefreshOutput) => Promise<void>;
};

export type SObjectGenerator = {
  generate: (output: SObjectRefreshOutput) => Promise<void>;
};

export type SObjectRefreshOutput = {
  sfdxPath: string;
  addTypeNames: (names: SObjectShortDescription[]) => void;
  getTypeNames: () => SObjectShortDescription[];
  addStandard: (standard: SObject[]) => void;
  getStandard: () => SObject[];
  addCustom: (standard: SObject[]) => void;
  getCustom: () => SObject[];
  setError: (message: string, stack?: string) => void;
};

export type SObjectRefreshResult = {
  data: {
    cancelled: boolean;
    standardObjects?: number;
    customObjects?: number;
  };
  error?: { message: string; stack?: string };
};
