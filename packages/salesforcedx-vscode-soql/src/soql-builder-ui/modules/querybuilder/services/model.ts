/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */
import { AndOr, ConditionOperator, UiOperatorValue } from '@salesforce/soql-model/model/model';
import { List, Map } from 'immutable';
import { JsonMap } from '@salesforce/ts-types';
import { isLikeStart, isLikeEnds, isLikeContains } from '../services/soqlUtils';

export enum ModelProps {
  FIELDS = 'fields',
  ORDER_BY = 'orderBy',
  LIMIT = 'limit',
  WHERE = 'where',
  WHERE_CONDITIONS = 'conditions',
  WHERE_AND_OR = 'andOr'
}

export const SELECT_COUNT = 'COUNT()';

// This is to satisfy TS and stay dry
export type IMap = Map<string, string | List<string>>;

// Private immutable interface
export type ToolingModel = IMap & {
  headerComments?: string;
  sObject: string;
  fields: List<string>;
  orderBy: List<Map>;
  limit: string;
  where: List<Map>;
  errors: List<Map>;
  unsupported: List<Map>;
  originalSoqlStatement: string;
}

// Public interface for accessing modelService.query
export type ToolingModelJson = JsonMap & {
  headerComments?: string;
  sObject: string;
  fields: string[];
  orderBy: JsonMap[];
  limit: string;
  where: { conditions: JsonMap; andOr: AndOr };
  errors: JsonMap[];
  unsupported: JsonMap[];
  originalSoqlStatement: string;
}

export type OperatorOption = {
  value: UiOperatorValue;
  displayValue: string;
  modelValue: ConditionOperator;
  predicate: (condition: JsonMap) => boolean;
}

