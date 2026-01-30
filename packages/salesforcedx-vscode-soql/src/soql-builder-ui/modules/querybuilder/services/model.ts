/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */
import { ConditionOperator } from '../../../../soql-model/model/model';
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
// Public interface for accessing modelService.query
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
  modelValue: ConditionOperator;
  predicate: (condition: JsonMap) => boolean;
}

export const operatorOptions: OperatorOption[] = [
  {
    value: 'EQ',
    displayValue: '=',
    modelValue: ConditionOperator.Equals,
    predicate: (condition: JsonMap): boolean => condition.operator === ConditionOperator.Equals
  },
  {
    value: 'NOT_EQ',
    displayValue: '≠',
    modelValue: ConditionOperator.NotEquals,
    predicate: (condition: JsonMap): boolean => condition.operator === ConditionOperator.NotEquals
  },
  {
    value: 'LT',
    displayValue: '<',
    modelValue: ConditionOperator.LessThan,
    predicate: (condition: JsonMap): boolean => condition.operator === ConditionOperator.LessThan
  },
  {
    value: 'LT_EQ',
    displayValue: '≤',
    modelValue: ConditionOperator.LessThanOrEqual,
    predicate: (condition: JsonMap): boolean => condition.operator === ConditionOperator.LessThanOrEqual
  },
  {
    value: 'GT',
    displayValue: '>',
    modelValue: ConditionOperator.GreaterThan,
    predicate: (condition: JsonMap): boolean => condition.operator === ConditionOperator.GreaterThan
  },
  {
    value: 'GT_EQ',
    displayValue: '≥',
    modelValue: ConditionOperator.GreaterThanOrEqual,
    predicate: (condition: JsonMap): boolean => condition.operator === ConditionOperator.GreaterThanOrEqual
  },
  {
    value: 'IN',
    displayValue: 'in',
    modelValue: ConditionOperator.In,
    predicate: (condition: JsonMap): boolean => condition.operator === ConditionOperator.In
  },
  {
    value: 'NOT_IN',
    displayValue: 'not in',
    modelValue: ConditionOperator.NotIn,
    predicate: (condition: JsonMap): boolean => condition.operator === ConditionOperator.NotIn
  },
  {
    value: 'INCLUDES',
    displayValue: 'includes',
    modelValue: ConditionOperator.Includes,
    predicate: (condition: JsonMap): boolean => condition.operator === ConditionOperator.Includes
  },
  {
    value: 'EXCLUDES',
    displayValue: 'excludes',
    modelValue: ConditionOperator.Excludes,
    predicate: (condition: JsonMap): boolean => condition.operator === ConditionOperator.Excludes
  },
  {
    value: 'LIKE',
    displayValue: 'like',
    modelValue: ConditionOperator.Like,
    predicate: (condition: JsonMap): boolean => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const value = condition.compareValue.value;
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
    predicate: (condition: JsonMap): boolean => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const value = condition.compareValue.value;
      return condition.operator === ConditionOperator.Like && isLikeStart(value);
    }
  },
  {
    value: 'LIKE_END',
    displayValue: 'ends with',
    modelValue: ConditionOperator.Like,
    predicate: (condition: JsonMap): boolean => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const value = condition.compareValue.value;
      return condition.operator === ConditionOperator.Like && isLikeEnds(value);
    }
  },
  {
    value: 'LIKE_CONTAINS',
    displayValue: 'contains',
    modelValue: ConditionOperator.Like,
    predicate: (condition: JsonMap): boolean => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const value = condition.compareValue.value;
      return condition.operator === ConditionOperator.Like && isLikeContains(value);
    }
  }
];
