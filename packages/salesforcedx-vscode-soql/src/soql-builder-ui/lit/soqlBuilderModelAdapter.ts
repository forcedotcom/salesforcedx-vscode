/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type {
  SoqlBuilderQuery,
  SoqlLiteral,
  SoqlWhereCondition
} from '@salesforce/soql-builder-ui/domain';
import {
  AndOr,
  ConditionOperator,
  deserialize,
  FieldCompareConditionImpl,
  FieldRefImpl,
  FieldSelectionImpl,
  FromImpl,
  HeaderCommentsImpl,
  IncludesConditionImpl,
  InListConditionImpl,
  LimitImpl,
  LiteralImpl,
  ModelSerializer,
  NullsOrder,
  Order,
  OrderByExpressionImpl,
  OrderByImpl,
  QueryImpl,
  SelectCountImpl,
  SelectExprsImpl,
  SoqlModelUtils,
  WhereImpl,
  type Condition,
  type Query
} from '@salesforce/soql-model';

const literalFromModel = (literal: unknown): SoqlLiteral | undefined =>
  literal instanceof LiteralImpl
    ? { kind: 'literal', type: literal.type, value: literal.value }
    : undefined;

const conditionFromModel = (condition: Condition, index: number): SoqlWhereCondition | undefined => {
  if (condition instanceof FieldCompareConditionImpl) {
    if (!(condition.field instanceof FieldRefImpl)) return undefined;
    const compareValue = literalFromModel(condition.compareValue);
    return compareValue
      ? {
          condition: {
            compareValue,
            field: { fieldName: condition.field.fieldName, kind: 'fieldRef' },
            kind: 'fieldCompare',
            operator: condition.operator
          },
          index
        }
      : undefined;
  }

  if (condition instanceof InListConditionImpl || condition instanceof IncludesConditionImpl) {
    if (!(condition.field instanceof FieldRefImpl)) return undefined;
    const values = condition.values.map(literalFromModel);
    if (values.includes(undefined)) return undefined;
    return {
      condition: {
        field: { fieldName: condition.field.fieldName, kind: 'fieldRef' },
        kind: condition.kind,
        operator: condition.operator,
        values: values.filter((value): value is SoqlLiteral => value !== undefined)
      },
      index
    };
  }

  return undefined;
};

const conditionOperators: Readonly<Record<SoqlWhereCondition['condition']['operator'], ConditionOperator>> = {
  '=': ConditionOperator.Equals,
  '!=': ConditionOperator.NotEquals,
  '<>': ConditionOperator.AlternateNotEquals,
  '<=': ConditionOperator.LessThanOrEqual,
  '>=': ConditionOperator.GreaterThanOrEqual,
  '<': ConditionOperator.LessThan,
  '>': ConditionOperator.GreaterThan,
  LIKE: ConditionOperator.Like,
  IN: ConditionOperator.In,
  'NOT IN': ConditionOperator.NotIn,
  INCLUDES: ConditionOperator.Includes,
  EXCLUDES: ConditionOperator.Excludes
};

export const parseSoqlBuilderQuery = (statement: string): SoqlBuilderQuery => {
  const model = deserialize(statement);
  const fields =
    model.select instanceof SelectExprsImpl
      ? model.select.selectExpressions.flatMap(expression =>
          expression instanceof FieldSelectionImpl && expression.field instanceof FieldRefImpl
            ? [expression.field.fieldName]
            : []
        )
      : model.select?.kind === 'selectCount'
        ? ['COUNT()']
        : [];
  const whereGroup =
    model.where?.condition && !SoqlModelUtils.containsUnmodeledSyntax(model.where.condition)
      ? SoqlModelUtils.simpleGroupToArray(model.where.condition)
      : undefined;
  const conditions = (whereGroup?.conditions ?? []).flatMap((condition, index) => {
    const mapped = conditionFromModel(condition, index);
    return mapped ? [mapped] : [];
  });
  const unsupportedSyntax = SoqlModelUtils.getUnmodeledSyntax(model).map(unsupported => ({
    reason: {
      message: unsupported.reason.message,
      reasonCode: unsupported.reason.reasonCode
    },
    unmodeledSyntax: unsupported.unmodeledSyntax
  }));

  return {
    ...(model.headerComments ? { headerComments: model.headerComments.text } : {}),
    allRows: model.allRows ?? false,
    fields,
    ...(model.limit ? { limit: String(model.limit.limit) } : {}),
    orderBy: (model.orderBy?.orderByExpressions ?? []).flatMap(expression =>
      expression.field instanceof FieldRefImpl && !SoqlModelUtils.containsUnmodeledSyntax(expression)
        ? [
            {
              field: expression.field.fieldName,
              ...(expression.order ? { order: expression.order } : {}),
              ...(expression.nullsOrder ? { nulls: expression.nullsOrder } : {})
            }
          ]
        : []
    ),
    originalSoqlStatement: statement,
    parseErrors: (model.errors ?? []).map(error => ({ ...error })),
    ...(model.from?.sobjectName ? { sObject: model.from.sobjectName } : {}),
    unsupportedSyntax,
    where: {
      ...(whereGroup?.andOr ? { andOr: whereGroup.andOr } : {}),
      conditions
    }
  };
};

const conditionToModel = (whereCondition: SoqlWhereCondition): Condition | undefined => {
  const field = new FieldRefImpl(whereCondition.condition.field.fieldName);
  if (whereCondition.condition.compareValue) {
    const value = whereCondition.condition.compareValue;
    return new FieldCompareConditionImpl(
      field,
      conditionOperators[whereCondition.condition.operator],
      new LiteralImpl(value.type, value.value)
    );
  }
  if (whereCondition.condition.values) {
    const values = whereCondition.condition.values.map(value => new LiteralImpl(value.type, value.value));
    return whereCondition.condition.kind === 'includes'
      ? new IncludesConditionImpl(field, conditionOperators[whereCondition.condition.operator], values)
      : new InListConditionImpl(field, conditionOperators[whereCondition.condition.operator], values);
  }
  return undefined;
};

const buildQueryModel = (query: SoqlBuilderQuery): Query => {
  const isCount = query.fields.length === 1 && query.fields[0].toUpperCase() === 'COUNT()';
  const select = isCount
    ? new SelectCountImpl()
    : new SelectExprsImpl(query.fields.map(field => new FieldSelectionImpl(new FieldRefImpl(field))));
  const conditions = query.where.conditions.flatMap(condition => {
    const mapped = conditionToModel(condition);
    return mapped ? [mapped] : [];
  });
  const where =
    conditions.length > 0
      ? new WhereImpl(
          SoqlModelUtils.arrayToSimpleGroup(
            conditions,
            query.where.andOr === 'AND' ? AndOr.And : query.where.andOr === 'OR' ? AndOr.Or : undefined
          )
        )
      : undefined;
  const orderByExpressions = query.orderBy.map(
    item =>
      new OrderByExpressionImpl(
        new FieldRefImpl(item.field),
        item.order === 'ASC' ? Order.Ascending : item.order === 'DESC' ? Order.Descending : undefined,
        item.nulls === 'NULLS FIRST'
          ? NullsOrder.First
          : item.nulls === 'NULLS LAST'
            ? NullsOrder.Last
            : undefined
      )
  );
  const model = new QueryImpl(
    select,
    new FromImpl(query.sObject ?? ''),
    where,
    undefined,
    undefined,
    orderByExpressions.length > 0 ? new OrderByImpl(orderByExpressions) : undefined,
    query.limit !== undefined ? new LimitImpl(Number(query.limit)) : undefined
  );
  if (query.headerComments) model.headerComments = new HeaderCommentsImpl(query.headerComments);
  model.allRows = query.allRows;
  return model;
};

export const serializeSoqlBuilderQuery = (query: SoqlBuilderQuery): string =>
  new ModelSerializer(buildQueryModel(query)).serialize();

export const createSoqlBuilderTelemetry = (query: SoqlBuilderQuery) => ({
  errors: query.parseErrors.map(error => `${String(error.type)}:${String(error.grammarRule)}`),
  fields: query.fields.length,
  limit: query.limit,
  orderBy: query.orderBy.length,
  sObject: query.sObject?.includes('__c') ? 'custom' : 'standard',
  unsupported: query.unsupportedSyntax.map(unsupported => unsupported.reason.reasonCode)
});
