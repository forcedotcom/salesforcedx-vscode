/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { UnmodeledSyntaxReason } from './unmodeled';

export type ModelError = {
  type: ErrorType;
  message: string;
  lineNumber: number;
  charInLine: number;
  grammarRule?: string;
};

export type ErrorType =
  | 'UNKNOWN'
  | 'EMPTY'
  | 'NOSELECT'
  | 'NOSELECTIONS'
  | 'NOFROM'
  | 'INCOMPLETEFROM'
  | 'INCOMPLETELIMIT'
  | 'EMPTYWHERE'
  | 'INCOMPLETENESTEDCONDITION'
  | 'INCOMPLETEANDORCONDITION'
  | 'INCOMPLETENOTCONDITION'
  | 'UNRECOGNIZEDCOMPAREVALUE'
  | 'UNRECOGNIZEDCOMPAREOPERATOR'
  | 'UNRECOGNIZEDCOMPAREFIELD'
  | 'NOCOMPAREVALUE'
  | 'NOCOMPAREOPERATOR'
  | 'INCOMPLETEMULTIVALUELIST'
  | 'UNEXPECTEDEOF';

export enum SObjectFieldType {
  Address = 'address',
  AnyType = 'anytype',
  Base64 = 'base64',
  Boolean = 'boolean',
  Combobox = 'combobox',
  ComplexValue = 'complexvalue',
  Currency = 'currency',
  Date = 'date',
  DateTime = 'datetime',
  Double = 'double',
  Email = 'email',
  EncryptedString = 'encryptedstring',
  Id = 'id',
  Integer = 'int',
  Location = 'location',
  Long = 'long',
  MultiPicklist = 'multipicklist',
  Percent = 'percent',
  Phone = 'phone',
  Picklist = 'picklist',
  Reference = 'reference',
  String = 'string',
  TextArea = 'textarea',
  Time = 'time',
  Url = 'url'
}

export type UiOperatorValue =
  | 'EQ'
  | 'NOT_EQ'
  | 'ALT_NOT_EQ'
  | 'LT_EQ'
  | 'GT_EQ'
  | 'LT'
  | 'GT'
  | 'LIKE'
  | 'LIKE_START'
  | 'LIKE_END'
  | 'LIKE_CONTAINS'
  | 'IN'
  | 'NOT_IN'
  | 'INCLUDES'
  | 'EXCLUDES';

export type SoqlModelObject = {
  errors?: ModelError[];
  toSoqlSyntax(options?: SyntaxOptions): string;
};

export class SyntaxOptions {
  public indent = 2;
}

export type Query = SoqlModelObject & {
  headerComments?: HeaderComments;
  select?: Select;
  from?: From;
  where?: Where;
  with?: With;
  groupBy?: GroupBy;
  orderBy?: OrderBy;
  limit?: Limit;
  offset?: Offset;
  bind?: Bind;
  recordTrackingType?: RecordTrackingType;
  update?: Update;
};

export type From = SoqlModelObject & {
  sobjectName: string;
  as?: UnmodeledSyntax;
  using?: UnmodeledSyntax;
};

export type Select = SoqlModelObject & {
  // SELECT COUNT() => SelectCount
  // SELECT [field] [subquery] [typeof] [distance] => SelectExprs
  kind: 'selectCount' | 'selectExprs';
};

export type SelectCount = Select & {
  kind: 'selectCount';
};

export type SelectExprs = Select & {
  kind: 'selectExprs';
  selectExpressions: SelectExpression[];
};

export type SelectExpression = SoqlModelObject & {
  // field => FieldSelection
  // subquery => UnmodeledSyntax
  // typeof => UnmodeledSyntax
  kind: 'fieldSelection' | 'unmodeled';
  alias?: UnmodeledSyntax;
};

export type FieldSelection = SelectExpression & {
  kind: 'fieldSelection';
  field: Field;
};

export type Field = SoqlModelObject & {
  // field name => FieldRef
  // function reference => UnmodeledSyntax
  // distance => UnmodeledSyntax
  kind: 'fieldRef' | 'unmodeled';
};

export type FieldRef = Field & {
  kind: 'fieldRef';
  fieldName: string;
};

export type Limit = SoqlModelObject & {
  limit: number;
};

export type OrderBy = SoqlModelObject & {
  orderByExpressions: OrderByExpression[];
};

export type OrderByExpression = SoqlModelObject & {
  field: Field;
  order?: Order;
  nullsOrder?: NullsOrder;
};

export enum Order {
  Ascending = 'ASC',
  Descending = 'DESC'
}

export enum NullsOrder {
  First = 'NULLS FIRST',
  Last = 'NULLS LAST'
}

export enum AndOr {
  And = 'AND',
  Or = 'OR'
}

export enum ConditionOperator {
  Equals = '=',
  NotEquals = '!=',
  AlternateNotEquals = '<>',
  LessThanOrEqual = '<=',
  GreaterThanOrEqual = '>=',
  LessThan = '<',
  GreaterThan = '>',
  Like = 'LIKE',
  In = 'IN',
  NotIn = 'NOT IN',
  Includes = 'INCLUDES',
  Excludes = 'EXCLUDES'
}

export type CompareValue = SoqlModelObject & {
  // literal => Literal
  // colon expression => UnmodeledSyntax
  kind: 'literal' | 'unmodeled';
};

export type LiteralType = 'BOOLEAN' | 'CURRENCY' | 'DATE' | 'NULL' | 'NUMBER' | 'STRING';

export type Literal = CompareValue & {
  kind: 'literal';
  value: string;
};

export type Condition = SoqlModelObject & {
  // ( nested-condition ) => NestedCondition
  // NOT condition => NotCondition
  // condition-1 AndOr condition-2 => AndOrCondition
  // field ConditionOperator value => FieldCompareCondition
  // calculation ConditionOperator value => UnmodeledSyntax
  // distance ConditionOperator value => UnmodeledSyntax
  // field [Includes|Excludes] ( values ) => IncludesCondition
  // field [In|NotIn] ( semi-join ) => UnmodeledSyntax
  // field [In|NotIn] ( values ) => InListCondition
  kind: 'nested' | 'not' | 'andOr' | 'fieldCompare' | 'includes' | 'inList' | 'unmodeled';
};

export type NestedCondition = Condition & {
  kind: 'nested';
  condition: Condition;
};

export type NotCondition = Condition & {
  kind: 'not';
  condition: Condition;
};

export type AndOrCondition = Condition & {
  kind: 'andOr';
  leftCondition: Condition;
  andOr: AndOr;
  rightCondition: Condition;
};

export type FieldCompareCondition = Condition & {
  kind: 'fieldCompare';
  field: Field;
  operator: ConditionOperator;
  compareValue: CompareValue;
};

export type IncludesCondition = Condition & {
  kind: 'includes';
  field: Field;
  operator: ConditionOperator;
  values: CompareValue[];
};

export type InListCondition = Condition & {
  kind: 'inList';
  field: Field;
  operator: ConditionOperator;
  values: CompareValue[];
};

export type Where = SoqlModelObject & {
  condition: Condition;
};
export type HeaderComments = SoqlModelObject & {
  text: string;
};

export type With = SoqlModelObject;
export type GroupBy = SoqlModelObject;
export type Offset = SoqlModelObject;
export type Bind = SoqlModelObject;
export type RecordTrackingType = SoqlModelObject;
export type Update = SoqlModelObject;

export type UnmodeledSyntax = SelectExpression &
  Field &
  Condition &
  CompareValue &
  With &
  GroupBy &
  Offset &
  Bind &
  RecordTrackingType &
  Update & {
    kind: 'unmodeled';
    unmodeledSyntax: string;
    reason: UnmodeledSyntaxReason;
  };

export * from './unmodeled';
