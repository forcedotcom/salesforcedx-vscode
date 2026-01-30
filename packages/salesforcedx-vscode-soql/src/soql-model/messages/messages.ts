/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// prettier-ignore
/* eslint-disable @typescript-eslint/naming-convention */
export const Messages = {
  error_empty: 'Incomplete SOQL statement. The SELECT and FROM clauses are required.',
  error_noSelect: 'A SELECT clause is required.',
  error_noSelections: 'Incomplete SELECT clause. The SELECT clause must contain at least one SELECT expression.',
  error_noFrom: 'A FROM clause is required.',
  error_incompleteFrom: 'Incomplete FROM clause. The FROM clause requires an object.',
  error_incompleteLimit: 'Incomplete LIMIT clause. The LIMIT keyword must be followed by a number.',
  error_emptyWhere: 'Incomplete WHERE clause. The WHERE clause must contain a condition.',
  error_incompleteNestedCondition: 'Incomplete condition. A closing parenthesis is required.',
  error_incompleteAndOrCondition: 'Incomplete condition. Conditions before and after the AND or OR keyword are required.',
  error_incompleteNotCondition: 'Incomplete condition. NOT must be followed by a condition.',
  error_unrecognizedCompareValue: 'Unrecognized comparison value.',
  error_unrecognizedCompareOperator: 'Unrecognized comparison operator.',
  error_unrecognizedCompareField: 'Unrecognized comparison field.',
  error_noCompareValue: 'Incomplete condition. Comparison value is required.',
  error_noCompareOperator: 'Incomplete condition. Comparison operator and value is required.',
  error_incompleteMultiValueList: 'Incomplete values list. Place values in parentheses, separated by commas.',
  error_unexpectedEOF: 'Unexpected end of file.',

  error_fieldInput_boolean: 'Value must be TRUE or FALSE',
  error_fieldInput_currency: 'Currency value is not valid',
  error_fieldInput_date: 'Date value is not valid',
  error_fieldInput_float: 'Value must be numeric',
  error_fieldInput_integer: 'Value must be a whole number',
  error_fieldInput_picklist: 'Value must be one of: {0}',
  error_fieldInput_string: 'Enclose value in single quotes',
  error_fieldInput_list: 'Input must be a comma separated list of values',

  error_operatorInput: "{0} operator can't be used for this field type",

  unmodeled_as: 'Object alias',
  unmodeled_using: 'USING SCOPE clause',
  unmodeled_alias: 'Field alias',
  unmodeled_semijoin: 'Subquery',
  unmodeled_typeof: 'TYPEOF clause',
  unmodeled_distance: 'DISTANCE expression',
  unmodeled_select: 'Unsupported SELECT expression',
  unmodeled_complexgroup: 'Complex condition containing NOT or a mix of AND and OR',
  unmodeled_count: 'COUNT function',
  unmodeled_with: 'WITH filtering expression',
  unmodeled_groupby: 'GROUP BY clause',
  unmodeled_offset: 'OFFSET clause',
  unmodeled_bind: 'BIND clause',
  unmodeled_recordtracking: 'Record tracking clause',
  unmodeled_update: 'Update statistics clause',
  unmodeled_functionreference: 'Function expression',
  unmodeled_colonexpression: 'Colon expression',
  unmodeled_emptycondition: 'Empty condition',
  unmodeled_calculatedcondition: 'Calculated condition field',
  unmodeled_distancecondition: 'DISTANCE condition',
  unmodeled_incolonexpressioncondition: 'Colon expression as IN value',
  unmodeled_insemijoincondition: 'Subquery as IN value',
} as const;
