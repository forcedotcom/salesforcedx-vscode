/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SObjectShortDescription } from '../describe';
import { SObject } from './describe';

export enum SObjectCategory {
  ALL = 'ALL',
  STANDARD = 'STANDARD',
  CUSTOM = 'CUSTOM'
}

export enum SObjectRefreshSource {
  Manual = 'manual',
  Startup = 'startup',
  StartupMin = 'startupmin'
}

export interface FieldDeclaration {
  modifier: string;
  type: string;
  name: string;
  comment?: string;
}

export type SObjectDefinition = Pick<SObject, 'name'> & {
  fields: FieldDeclaration[];
};

export interface SObjectDefinitionRetriever {
  retrieve: (output: SObjectRefreshOutput) => Promise<void>;
}

export interface SObjectGenerator {
  generate: (output: SObjectRefreshOutput) => void;
}

export interface SObjectRefreshOutput {
  sfdxPath: string;
  addTypeNames: (names: SObjectShortDescription[]) => void;
  getTypeNames: () => SObjectShortDescription[];
  addStandard: (standard: SObject[]) => void;
  getStandard: () => SObject[];
  addCustom: (standard: SObject[]) => void;
  getCustom: () => SObject[];
  setError: (message: string, stack?: string) => void;
}

export interface SObjectRefreshResult {
  data: {
    cancelled: boolean;
    standardObjects?: number;
    customObjects?: number;
  };
  error?: { message: string; stack?: string };
}
