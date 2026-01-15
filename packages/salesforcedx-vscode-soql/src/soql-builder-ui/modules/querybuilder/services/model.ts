/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */
import { Soql } from '@salesforce/soql-model';
import { List, Map } from 'immutable';
import { JsonMap } from '@salesforce/ts-types';
import { isLikeStart, isLikeEnds, isLikeContains } from '../services/soqlUtils';

export enum ModelProps {
  SOBJECT = 'sObject',
  FIELDS = 'fields',
  ORDER_BY = 'orderBy',
  LIMIT = 'limit',
  WHERE = 'where',
  WHERE_CONDITIONS = 'conditions',
  WHERE_AND_OR = 'andOr',
  ERRORS = 'errors',
  UNSUPPORTED = 'unsupported',
  ORIGINAL_SOQL_STATEMENT = 'originalSoqlStatement'
}

export enum AndOr {
  AND = 'AND',
  OR = 'OR'
}

export const SELECT_COUNT = 'COUNT()';

// This is to satisfy TS and stay dry
export type IMap = Map<string, string | List<string>>;
// Private immutable interface
export interface ToolingModel extends IMap {
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
// Public inteface for accessing modelService.query
export interface ToolingModelJson extends JsonMap {
  headerComments?: string;
  sObject: string;
  fields: string[];
  orderBy: JsonMap[];
  limit: string;
  where: { conditions: JsonMap; andOr: string };
  errors: JsonMap[];
  unsupported: JsonMap[];
  originalSoqlStatement: string;
}

export interface OperatorOption {
  value: string;
  displayValue: string;
  modelValue: Soql.ConditionOperator;
  predicate: (condition: JsonMap) => boolean;
}

export const operatorOptions: OperatorOption[] = [
  {
    value: 'EQ',
    displayValue: '=',
    modelValue: Soql.ConditionOperator.Equals,
    predicate: (conditon: JsonMap): boolean =>
      conditon.operator === Soql.ConditionOperator.Equals
  },
  {
    value: 'NOT_EQ',
    displayValue: '≠',
    modelValue: Soql.ConditionOperator.NotEquals,
    predicate: (conditon: JsonMap): boolean =>
      conditon.operator === Soql.ConditionOperator.NotEquals
  },
  {
    value: 'LT',
    displayValue: '<',
    modelValue: Soql.ConditionOperator.LessThan,
    predicate: (conditon: JsonMap): boolean =>
      conditon.operator === Soql.ConditionOperator.LessThan
  },
  {
    value: 'LT_EQ',
    displayValue: '≤',
    modelValue: Soql.ConditionOperator.LessThanOrEqual,
    predicate: (conditon: JsonMap): boolean =>
      conditon.operator === Soql.ConditionOperator.LessThanOrEqual
  },
  {
    value: 'GT',
    displayValue: '>',
    modelValue: Soql.ConditionOperator.GreaterThan,
    predicate: (conditon: JsonMap): boolean =>
      conditon.operator === Soql.ConditionOperator.GreaterThan
  },
  {
    value: 'GT_EQ',
    displayValue: '≥',
    modelValue: Soql.ConditionOperator.GreaterThanOrEqual,
    predicate: (conditon: JsonMap): boolean =>
      conditon.operator === Soql.ConditionOperator.GreaterThanOrEqual
  },
  {
    value: 'IN',
    displayValue: 'in',
    modelValue: Soql.ConditionOperator.In,
    predicate: (conditon: JsonMap): boolean =>
      conditon.operator === Soql.ConditionOperator.In
  },
  {
    value: 'NOT_IN',
    displayValue: 'not in',
    modelValue: Soql.ConditionOperator.NotIn,
    predicate: (conditon: JsonMap): boolean =>
      conditon.operator === Soql.ConditionOperator.NotIn
  },
  {
    value: 'INCLUDES',
    displayValue: 'includes',
    modelValue: Soql.ConditionOperator.Includes,
    predicate: (conditon: JsonMap): boolean =>
      conditon.operator === Soql.ConditionOperator.Includes
  },
  {
    value: 'EXCLUDES',
    displayValue: 'excludes',
    modelValue: Soql.ConditionOperator.Excludes,
    predicate: (conditon: JsonMap): boolean =>
      conditon.operator === Soql.ConditionOperator.Excludes
  },
  {
    value: 'LIKE',
    displayValue: 'like',
    modelValue: Soql.ConditionOperator.Like,
    predicate: (conditon: JsonMap): boolean => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const value = conditon.compareValue.value;
      return (
        conditon.operator === Soql.ConditionOperator.Like &&
        !(isLikeStart(value) || isLikeEnds(value) || isLikeContains(value))
      );
    }
  },
  {
    value: 'LIKE_START',
    displayValue: 'starts with',
    modelValue: Soql.ConditionOperator.Like,
    predicate: (conditon: JsonMap): boolean => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const value = conditon.compareValue.value;
      return (
        conditon.operator === Soql.ConditionOperator.Like && isLikeStart(value)
      );
    }
  },
  {
    value: 'LIKE_END',
    displayValue: 'ends with',
    modelValue: Soql.ConditionOperator.Like,
    predicate: (conditon: JsonMap): boolean => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const value = conditon.compareValue.value;
      return (
        conditon.operator === Soql.ConditionOperator.Like && isLikeEnds(value)
      );
    }
  },
  {
    value: 'LIKE_CONTAINS',
    displayValue: 'contains',
    modelValue: Soql.ConditionOperator.Like,
    predicate: (conditon: JsonMap): boolean => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const value = conditon.compareValue.value;
      return (
        conditon.operator === Soql.ConditionOperator.Like &&
        isLikeContains(value)
      );
    }
  }
];
