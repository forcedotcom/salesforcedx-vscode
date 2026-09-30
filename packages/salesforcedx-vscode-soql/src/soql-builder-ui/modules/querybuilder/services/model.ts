/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */
import { AndOr, ConditionOperator, UiOperatorValue } from '@salesforce/soql-model';
import type { JsonObject } from '../../../../json';
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

// Public interface for accessing modelService.query
export type ToolingModelJson = JsonObject & {
  headerComments?: string;
  allRows: boolean;
  sObject: string;
  fields: string[];
  orderBy: JsonObject[];
  limit: string;
  where: { conditions: JsonObject[]; andOr: AndOr | undefined };
  errors: JsonObject[];
  unsupported: JsonObject[];
  originalSoqlStatement: string;
}

export type OperatorOption = {
  value: UiOperatorValue;
  displayValue: string;
  modelValue: ConditionOperator;
  predicate: (condition: JsonObject) => boolean;
}

export const operatorOptions: OperatorOption[] = [
  {
    value: 'EQ',
    displayValue: '=',
    modelValue: ConditionOperator.Equals,
    predicate: (condition: JsonObject): boolean => condition.operator === ConditionOperator.Equals
  },
  {
    value: 'NOT_EQ',
    displayValue: '≠',
    modelValue: ConditionOperator.NotEquals,
    predicate: (condition: JsonObject): boolean => condition.operator === ConditionOperator.NotEquals
  },
  {
    value: 'LT',
    displayValue: '<',
    modelValue: ConditionOperator.LessThan,
    predicate: (condition: JsonObject): boolean => condition.operator === ConditionOperator.LessThan
  },
  {
    value: 'LT_EQ',
    displayValue: '≤',
    modelValue: ConditionOperator.LessThanOrEqual,
    predicate: (condition: JsonObject): boolean => condition.operator === ConditionOperator.LessThanOrEqual
  },
  {
    value: 'GT',
    displayValue: '>',
    modelValue: ConditionOperator.GreaterThan,
    predicate: (condition: JsonObject): boolean => condition.operator === ConditionOperator.GreaterThan
  },
  {
    value: 'GT_EQ',
    displayValue: '≥',
    modelValue: ConditionOperator.GreaterThanOrEqual,
    predicate: (condition: JsonObject): boolean => condition.operator === ConditionOperator.GreaterThanOrEqual
  },
  {
    value: 'IN',
    displayValue: 'in',
    modelValue: ConditionOperator.In,
    predicate: (condition: JsonObject): boolean => condition.operator === ConditionOperator.In
  },
  {
    value: 'NOT_IN',
    displayValue: 'not in',
    modelValue: ConditionOperator.NotIn,
    predicate: (condition: JsonObject): boolean => condition.operator === ConditionOperator.NotIn
  },
  {
    value: 'INCLUDES',
    displayValue: 'includes',
    modelValue: ConditionOperator.Includes,
    predicate: (condition: JsonObject): boolean => condition.operator === ConditionOperator.Includes
  },
  {
    value: 'EXCLUDES',
    displayValue: 'excludes',
    modelValue: ConditionOperator.Excludes,
    predicate: (condition: JsonObject): boolean => condition.operator === ConditionOperator.Excludes
  },
  {
    value: 'LIKE',
    displayValue: 'like',
    modelValue: ConditionOperator.Like,
    predicate: (condition: JsonObject): boolean => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = (condition.compareValue as any)?.value;
      return (
        condition.operator === ConditionOperator.Like &&
        !(isLikeStart(value) || isLikeEnds(value) || isLikeContains(value))
      );
    }
  },
  {
    value: 'LIKE_START',
    displayValue: 'starts with',
    modelValue: ConditionOperator.Like,
    predicate: (condition: JsonObject): boolean => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = (condition.compareValue as any)?.value;
      return condition.operator === ConditionOperator.Like && isLikeStart(value);
    }
  },
  {
    value: 'LIKE_END',
    displayValue: 'ends with',
    modelValue: ConditionOperator.Like,
    predicate: (condition: JsonObject): boolean => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = (condition.compareValue as any)?.value;
      return condition.operator === ConditionOperator.Like && isLikeEnds(value);
    }
  },
  {
    value: 'LIKE_CONTAINS',
    displayValue: 'contains',
    modelValue: ConditionOperator.Like,
    predicate: (condition: JsonObject): boolean => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = (condition.compareValue as any)?.value;
      return condition.operator === ConditionOperator.Like && isLikeContains(value);
    }
  }
];
