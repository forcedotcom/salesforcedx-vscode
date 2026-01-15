/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { UnmodeledSyntaxReason } from './unmodeled';

export interface ModelError {
  type: ErrorType;
  message: string;
  lineNumber: number;
  charInLine: number;
  grammarRule?: string;
}

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
  UNEXPECTEDEOF = 'UNEXPECTEDEOF',
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
  Url = 'url',
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
  EXCLUDES = 'EXCLUDES',
}

export interface SoqlModelObject {
  errors?: ModelError[];
  toSoqlSyntax(options?: SyntaxOptions): string;
}

export class SyntaxOptions {
  public wrapColumn = 80;
  public indent = 2;
}

export interface Query extends SoqlModelObject {
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
}

export interface From extends SoqlModelObject {
  sobjectName: string;
  as?: UnmodeledSyntax;
  using?: UnmodeledSyntax;
}

export interface Select extends SoqlModelObject {
  // SELECT COUNT() => SelectCount
  // SELECT [field] [subquery] [typeof] [distance] => SelectExprs
}

export interface SelectCount extends Select {}

export interface SelectExprs extends Select {
  selectExpressions: SelectExpression[];
}

export interface SelectExpression extends SoqlModelObject {
  // field => Field
  // subquery => UnmodeledSyntax
  // typeof => UnmodeledSyntax
  alias?: UnmodeledSyntax;
}

export interface FieldSelection extends SelectExpression {
  field: Field;
}

export interface Field extends SoqlModelObject {
  // field name => FieldRef
  // function reference => UnmodeledSyntax
  // distance => UnmodeledSyntax
}

export interface FieldRef extends Field {
  fieldName: string;
}

export interface Limit extends SoqlModelObject {
  limit: number;
}

export interface OrderBy extends SoqlModelObject {
  orderByExpressions: OrderByExpression[];
}

export interface OrderByExpression extends SoqlModelObject {
  field: Field;
  order?: Order;
  nullsOrder?: NullsOrder;
}

export enum Order {
  Ascending = 'ASC',
  Descending = 'DESC',
}

export enum NullsOrder {
  First = 'NULLS FIRST',
  Last = 'NULLS LAST',
}

export enum AndOr {
  And = 'AND',
  Or = 'OR',
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
  Excludes = 'EXCLUDES',
}

export interface CompareValue extends SoqlModelObject {
  // literal => Literal
  // colon expression => UnmodeledSyntax
}

export enum LiteralType {
  Boolean = 'BOOLEAN',
  Currency = 'CURRENCY',
  Date = 'DATE',
  Null = 'NULL',
  Number = 'NUMBER',
  String = 'STRING',
}

export interface Literal extends CompareValue {
  type: LiteralType;
  value: string;
}

export interface Condition extends SoqlModelObject {
  // ( nested-condition ) => NestedCondition
  // NOT condition => NotCondition
  // condition-1 AndOr condition-2 => AndOrCondition
  // field ConditionOperator value => FieldCompareCondition
  // calculation ConditionOperator value => UnmodeledSyntax
  // distance ConditionOperator value => UnmodeledSyntax
  // field [Includes|Excludes] ( values ) => IncludesCondition
  // field [In|NotIn] ( semi-join ) => UnmodeledSyntax
  // field [In|NotIn] ( values ) => InListCondition
}

export interface NestedCondition extends Condition {
  condition: Condition;
}

export interface NotCondition extends Condition {
  condition: Condition;
}

export interface AndOrCondition extends Condition {
  leftCondition: Condition;
  andOr: AndOr;
  rightCondition: Condition;
}

export interface FieldCompareCondition extends Condition {
  field: Field;
  operator: ConditionOperator;
  compareValue: CompareValue;
}

export interface IncludesCondition extends Condition {
  field: Field;
  operator: ConditionOperator;
  values: CompareValue[];
}

export interface InListCondition extends Condition {
  field: Field;
  operator: ConditionOperator;
  values: CompareValue[];
}

export interface Where extends SoqlModelObject {
  condition: Condition;
}
export interface HeaderComments extends SoqlModelObject {
  text: string;
}

export interface With extends SoqlModelObject {}
export interface GroupBy extends SoqlModelObject {}
export interface Offset extends SoqlModelObject {}
export interface Bind extends SoqlModelObject {}
export interface RecordTrackingType extends SoqlModelObject {}
export interface Update extends SoqlModelObject {}

export interface UnmodeledSyntax
  extends SelectExpression,
    Field,
    Condition,
    CompareValue,
    With,
    GroupBy,
    Offset,
    Bind,
    RecordTrackingType,
    Update {
  unmodeledSyntax: string;
  reason: UnmodeledSyntaxReason;
}

export * from './unmodeled';
