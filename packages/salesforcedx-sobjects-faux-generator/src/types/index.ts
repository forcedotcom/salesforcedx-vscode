/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export {
  BatchRequest,
  BatchResponse,
  ChildRelationship,
  Field,
  SObject
} from './describe';
export { SObjectCategory, SObjectRefreshSource } from './general';
export { SObjectDefinition };

import { SObjectDefinition } from '../generator/types';
import { SObjectCategory, SObjectRefreshSource } from './general';

export interface SObjectDefinitionRetriever {
  retrieve: (output: SObjectRefreshOutput) => Promise<void>;
}

export interface SObjectRefreshResult {
  data: {
    category?: SObjectCategory;
    source?: SObjectRefreshSource;
    cancelled: boolean;
    standardObjects?: number;
    customObjects?: number;
  };
  error?: { message: string; stack?: string };
}

export interface SObjectRefreshOutput {
  sfdxPath: string;
  addStandard: (standard: SObjectDefinition[]) => void;
  getStandard: () => SObjectDefinition[];
  addCustom: (standard: SObjectDefinition[]) => void;
  getCustom: () => SObjectDefinition[];
  setError: (message: string, stack?: string) => void;
}

export interface SObjectGenerator {
  generate: (output: SObjectRefreshOutput) => void;
}
