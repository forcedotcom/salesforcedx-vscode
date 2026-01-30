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

export enum ErrorType {
  UNKNOWN = 'UNKNOWN',
  EMPTY = 'EMPTY',
  NOSELECT = 'NOSELECT',
  NOSELECTIONS = 'NOSELECTIONS',
  NOFROM = 'NOFROM',
  INCOMPLETEFROM = 'INCOMPLETEFROM',
  INCOMPLETELIMIT = 'INCOMPLETELIMIT',
  EMPTYWHERE = 'EMPTYWHERE',
  INCOMPLETENESTEDCONDITION = 'INCOMPLETENESTEDCONDITION',
  INCOMPLETEANDORCONDITION = 'INCOMPLETEANDORCONDITION',
  INCOMPLETENOTCONDITION = 'INCOMPLETENOTCONDITION',
  UNRECOGNIZEDCOMPAREVALUE = 'UNRECOGNIZEDCOMPAREVALUE',
  UNRECOGNIZEDCOMPAREOPERATOR = 'UNRECOGNIZEDCOMPAREOPERATOR',
  UNRECOGNIZEDCOMPAREFIELD = 'UNRECOGNIZEDCOMPAREFIELD',
  NOCOMPAREVALUE = 'NOCOMPAREVALUE',
  NOCOMPAREOPERATOR = 'NOCOMPAREOPERATOR',
  INCOMPLETEMULTIVALUELIST = 'INCOMPLETEMULTIVALUELIST',
  UNEXPECTEDEOF = 'UNEXPECTEDEOF'
}

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

export enum UiOperatorValue {
  EQ = 'EQ',
  NOT_EQ = 'NOT_EQ',
  ALT_NOT_EQ = 'ALT_NOT_EQ',
  LT_EQ = 'LT_EQ',
  GT_EQ = 'GT_EQ',
  LT = 'LT',
  GT = 'GT',
  LIKE = 'LIKE',
  LIKE_START = 'LIKE_START',
  LIKE_END = 'LIKE_END',
  LIKE_CONTAINS = 'LIKE_CONTAINS',
  IN = 'IN',
  NOT_IN = 'NOT_IN',
  INCLUDES = 'INCLUDES',
  EXCLUDES = 'EXCLUDES'
}

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
};

export type SelectCount = Select;

export type SelectExprs = Select & {
  selectExpressions: SelectExpression[];
};

export type SelectExpression = SoqlModelObject & {
  // field => Field
  // subquery => UnmodeledSyntax
  // typeof => UnmodeledSyntax
  alias?: UnmodeledSyntax;
};

export type FieldSelection = SelectExpression & {
  field: Field;
};

export type Field = SoqlModelObject & {
  // field name => FieldRef
  // function reference => UnmodeledSyntax
  // distance => UnmodeledSyntax
};

export type FieldRef = Field & {
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
};

export enum LiteralType {
  Boolean = 'BOOLEAN',
  Currency = 'CURRENCY',
  Date = 'DATE',
  Null = 'NULL',
  Number = 'NUMBER',
  String = 'STRING'
}

export type Literal = CompareValue & {
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
};

export type NestedCondition = Condition & {
  condition: Condition;
};

export type NotCondition = Condition & {
  condition: Condition;
};

export type AndOrCondition = Condition & {
  leftCondition: Condition;
  andOr: AndOr;
  rightCondition: Condition;
};

export type FieldCompareCondition = Condition & {
  field: Field;
  operator: ConditionOperator;
  compareValue: CompareValue;
};

export type IncludesCondition = Condition & {
  field: Field;
  operator: ConditionOperator;
  values: CompareValue[];
};

export type InListCondition = Condition & {
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
    unmodeledSyntax: string;
    reason: UnmodeledSyntaxReason;
  };

export * from './unmodeled';
