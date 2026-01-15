/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// prettier-ignore
/* eslint-disable @typescript-eslint/naming-convention */
export namespace Messages {
  export const error_empty = 'Incomplete SOQL statement. The SELECT and FROM clauses are required.';
  export const error_noSelect = 'A SELECT clause is required.';
  export const error_noSelections = 'Incomplete SELECT clause. The SELECT clause must contain at least one SELECT expression.';
  export const error_noFrom = 'A FROM clause is required.';
  export const error_incompleteFrom = 'Incomplete FROM clause. The FROM clause requires an object.';
  export const error_incompleteLimit = 'Incomplete LIMIT clause. The LIMIT keyword must be followed by a number.';
  export const error_emptyWhere = 'Incomplete WHERE clause. The WHERE clause must contain a condition.';
  export const error_incompleteNestedCondition = 'Incomplete condition. A closing parenthesis is required.';
  export const error_incompleteAndOrCondition = 'Incomplete condition. Conditions before and after the AND or OR keyword are required.';
  export const error_incompleteNotCondition = 'Incomplete condition. NOT must be followed by a condition.';
  export const error_unrecognizedCompareValue = 'Unrecognized comparison value.';
  export const error_unrecognizedCompareOperator = 'Unrecognized comparison operator.';
  export const error_unrecognizedCompareField = 'Unrecognized comparison field.';
  export const error_noCompareValue = 'Incomplete condition. Comparison value is required.';
  export const error_noCompareOperator = 'Incomplete condition. Comparison operator and value is required.';
  export const error_incompleteMultiValueList = 'Incomplete values list. Place values in parentheses, separated by commas.';
  export const error_unexpectedEOF = 'Unexpected end of file.';

  export const error_fieldInput_boolean = 'Value must be TRUE or FALSE';
  export const error_fieldInput_currency = 'Currency value is not valid';
  export const error_fieldInput_date = 'Date value is not valid';
  export const error_fieldInput_float = 'Value must be numeric';
  export const error_fieldInput_integer = 'Value must be a whole number';
  export const error_fieldInput_picklist = 'Value must be one of: {0}';
  export const error_fieldInput_string = 'Enclose value in single quotes';
  export const error_fieldInput_list = 'Input must be a comma separated list of values';

  export const error_operatorInput = "{0} operator can't be used for this field type";

  export const unmodeled_as = 'Object alias';
  export const unmodeled_using = 'USING SCOPE clause';
  export const unmodeled_alias = 'Field alias';
  export const unmodeled_semijoin = 'Subquery';
  export const unmodeled_typeof = 'TYPEOF clause';
  export const unmodeled_distance = 'DISTANCE expression';
  export const unmodeled_select = 'Unsupported SELECT expression';
  export const unmodeled_complexgroup = 'Complex condition containing NOT or a mix of AND and OR';
  export const unmodeled_count = 'COUNT function';
  export const unmodeled_with = 'WITH filtering expression';
  export const unmodeled_groupby = 'GROUP BY clause';
  export const unmodeled_offset = 'OFFSET clause';
  export const unmodeled_bind = 'BIND clause';
  export const unmodeled_recordtracking = 'Record tracking clause';
  export const unmodeled_update = 'Update statistics clause';
  export const unmodeled_functionreference = 'Function expression';
  export const unmodeled_colonexpression = 'Colon expression';
  export const unmodeled_emptycondition = 'Empty condition';
  export const unmodeled_calculatedcondition = 'Calculated condition field';
  export const unmodeled_distancecondition = 'DISTANCE condition';
  export const unmodeled_incolonexpressioncondition = 'Colon expression as IN value';
  export const unmodeled_insemijoincondition = 'Subquery as IN value';
}
