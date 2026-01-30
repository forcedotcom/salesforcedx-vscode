/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return */
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConditionOperator, Query, Select, SelectExprs, UiOperatorValue } from '../../../../soql-model/model/model';
import { SoqlModelUtils } from '../../../../soql-model/model/util';
import { ModelSerializer } from '../../../../soql-model/serialization/serializer';
import { deserialize } from '../../../../soql-model/serialization/deserializer';
import { FieldCompareConditionImpl } from '../../../../soql-model/model/impl/fieldCompareConditionImpl';
import { FieldRefImpl } from '../../../../soql-model/model/impl/fieldRefImpl';
import { FieldSelectionImpl } from '../../../../soql-model/model/impl/fieldSelectionImpl';
import { FromImpl } from '../../../../soql-model/model/impl/fromImpl';
import { HeaderCommentsImpl } from '../../../../soql-model/model/impl/headerCommentsImpl';
import { IncludesConditionImpl } from '../../../../soql-model/model/impl/includesConditionImpl';
import { InListConditionImpl } from '../../../../soql-model/model/impl/inListConditionImpl';
import { LimitImpl } from '../../../../soql-model/model/impl/limitImpl';
import { LiteralImpl } from '../../../../soql-model/model/impl/literalImpl';
import { OrderByExpressionImpl } from '../../../../soql-model/model/impl/orderByExpressionImpl';
import { OrderByImpl } from '../../../../soql-model/model/impl/orderByImpl';
import { QueryImpl } from '../../../../soql-model/model/impl/queryImpl';
import { SelectCountImpl } from '../../../../soql-model/model/impl/selectCountImpl';
import { SelectExprsImpl } from '../../../../soql-model/model/impl/selectExprsImpl';
import { WhereImpl } from '../../../../soql-model/model/impl/whereImpl';
import { SELECT_COUNT, ToolingModelJson } from './model';

export function convertSoqlToUiModel(soql: string): ToolingModelJson {
  const queryModel = deserialize(soql);
  const uimodel = convertSoqlModelToUiModel(queryModel);
  return uimodel;
}

// eslint-disable-next-line complexity
function convertSoqlModelToUiModel(queryModel: Query): ToolingModelJson {
  const unsupported = [];
  const headerComments = queryModel.headerComments ? queryModel.headerComments.text : undefined;

  const fields =
    queryModel.select && (queryModel.select as SelectExprs).selectExpressions
      ? (queryModel.select as SelectExprs).selectExpressions
          .filter(expr => !SoqlModelUtils.containsUnmodeledSyntax(expr))
          .map(expr => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (expr.field.fieldName) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-member-access
              return expr.field.fieldName;
            }
            return undefined;
          })
      : [SELECT_COUNT];

  const sObject = queryModel.from && queryModel.from.sobjectName;

  let where;
  if (queryModel.where && queryModel.where.condition) {
    const conditionsObj = queryModel.where.condition;

    if (!SoqlModelUtils.isUnmodeledSyntax(conditionsObj)) {
      const simpleGroupArray = SoqlModelUtils.simpleGroupToArray(conditionsObj);
      where = {
        conditions: simpleGroupArray.conditions.map((condition, index) => {
          return {
            condition,
            index
          };
        }),
        andOr: simpleGroupArray.andOr
      };
    }
  }

  const orderBy = queryModel.orderBy
    ? queryModel.orderBy.orderByExpressions
        // TODO: Deal with empty OrderBy.  returns unmodelled syntax.
        .filter(expr => !SoqlModelUtils.containsUnmodeledSyntax(expr))
        .map(expression => {
          return {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            field: expression.field.fieldName,
            order: expression.order,
            nulls: expression.nullsOrder
          };
        })
    : [];

  const limit = queryModel.limit ? queryModel.limit.limit.toString() : undefined;

  const errors = queryModel.errors;
  for (const key in queryModel) {
    // eslint-disable-next-line no-prototype-builtins
    if (queryModel.hasOwnProperty(key)) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment,@typescript-eslint/no-unsafe-assignment
      const prop = queryModel[key];
      if (typeof prop === 'object') {
        if (SoqlModelUtils.containsUnmodeledSyntax(prop)) {
          SoqlModelUtils.getUnmodeledSyntax(prop, unsupported);
        }
      }
    }
  }

  const toolingModelTemplate: ToolingModelJson = {
    headerComments,
    sObject: sObject || '',
    fields: fields || [],
    where: where || { conditions: [], andOr: undefined },
    orderBy: orderBy || [],
    limit: limit || '',
    errors: errors || [],
    unsupported: unsupported || []
  };

  // USEFUL console.log('Soql -> Ui ', JSON.stringify(toolingModelTemplate.orderBy));

  return toolingModelTemplate;
}

export function convertUiModelToSoql(uiModel: ToolingModelJson): string {
  const soqlModel = convertUiModelToSoqlModel(uiModel);
  const soql = convertSoqlModelToSoql(soqlModel);
  return soql;
}

function convertUiModelToSoqlModel(uiModel: ToolingModelJson): Query {
  let select: Select;
  const isSelectCount = uiModel.fields.length === 1 && uiModel.fields[0].toLowerCase() === SELECT_COUNT.toLowerCase();
  if (isSelectCount) {
    select = new SelectCountImpl();
  } else {
    const selectExprs = uiModel.fields.map(field => new FieldSelectionImpl(new FieldRefImpl(field)));
    select = new SelectExprsImpl(selectExprs);
  }

  let whereExprsImpl;
  if (uiModel.where && uiModel.where.conditions.length) {
    const simpleGroupArray = uiModel.where.conditions.map(condition => {
      const uiModelCondition = condition.condition;
      let returnCondition;

      const field =
        uiModelCondition.field && uiModelCondition.field.fieldName
          ? new FieldRefImpl(uiModelCondition.field.fieldName)
          : undefined;

      enum ConditionType {
        FieldCompare = 0,
        In = 1,
        Includes = 2
      }
      let conditionType = ConditionType.FieldCompare;
      // eslint-disable-next-line default-case
      switch (uiModelCondition.operator) {
        case ConditionOperator.In:
        case ConditionOperator.NotIn: {
          conditionType = ConditionType.In;
          break;
        }
        case ConditionOperator.Includes:
        case ConditionOperator.Excludes: {
          conditionType = ConditionType.Includes;
          break;
        }
      }

      const compareValue = uiModelCondition.compareValue
        ? new LiteralImpl(uiModelCondition.compareValue.value)
        : uiModelCondition.values
          ? uiModelCondition.values.map(value => new LiteralImpl(value.value))
          : undefined;

      if (field && compareValue) {
        // eslint-disable-next-line default-case
        switch (conditionType) {
          case ConditionType.FieldCompare: {
            returnCondition = new FieldCompareConditionImpl(field, uiModelCondition.operator, compareValue);
            break;
          }
          case ConditionType.In: {
            returnCondition = new InListConditionImpl(field, uiModelCondition.operator, compareValue);
            break;
          }
          case ConditionType.Includes: {
            returnCondition = new IncludesConditionImpl(field, uiModelCondition.operator, compareValue);
            break;
          }
        }
      }

      return returnCondition;
    });
    whereExprsImpl = SoqlModelUtils.arrayToSimpleGroup(simpleGroupArray, uiModel.where.andOr);
  }

  const where = whereExprsImpl && Object.keys(whereExprsImpl).length ? new WhereImpl(whereExprsImpl) : undefined;

  const orderByExprs = uiModel.orderBy.map(
    orderBy => new OrderByExpressionImpl(new FieldRefImpl(orderBy.field), orderBy.order, orderBy.nulls)
  );
  const orderBy = orderByExprs.length > 0 ? new OrderByImpl(orderByExprs) : undefined;
  const limit = uiModel.limit.length > 0 ? new LimitImpl(uiModel.limit) : undefined;
  const queryModel = new QueryImpl(
    select,
    new FromImpl(uiModel.sObject),
    where,
    undefined,
    undefined,
    orderBy,
    limit
  );
  if (uiModel.headerComments) {
    queryModel.headerComments = new HeaderCommentsImpl(uiModel.headerComments);
  }
  return queryModel;
}

function convertSoqlModelToSoql(soqlModel: Query): string {
  const serializer = new ModelSerializer(soqlModel);
  const query = serializer.serialize();
  return query;
}

export function soqlStringLiteralToDisplayValue(soqlString: string): string {
  let displayValue = soqlString;

  // unquote
  if (displayValue.startsWith("'")) {
    displayValue = displayValue.substring(1);
  }
  if (displayValue.endsWith("'")) {
    displayValue = displayValue.substring(0, displayValue.length - 1);
  }

  // unescape
  displayValue = displayValue.replace(/\\"/g, '"');
  displayValue = displayValue.replace(/\\'/g, "'");
  displayValue = displayValue.replace(/\\\\/g, '\\');

  return displayValue;
}

export function displayValueToSoqlStringLiteral(displayString: string): string {
  // string
  let normalized = displayString;

  // escape
  normalized = normalized.replace(/\\/g, '\\\\');
  normalized = normalized.replace(/'/g, "\\'");
  normalized = normalized.replace(/"/g, '\\"');

  // quote
  normalized = `'${normalized}'`;

  return normalized;
}

/* ======= LIKE OPERATOR UTILS ======= */
const WILD_CARD = '%';

/* LIKE_START ABC% */
export function isLikeStart(value: string): boolean {
  if (value && value.length) {
    value = soqlStringLiteralToDisplayValue(value);
    if (value.endsWith(WILD_CARD) && !value.startsWith(WILD_CARD)) {
      return true;
    }
  }
  return false;
}
/* LIKE_END %ABC */
export function isLikeEnds(value: string): boolean {
  if (value && value.length) {
    value = soqlStringLiteralToDisplayValue(value);
    if (value.startsWith(WILD_CARD) && !value.endsWith(WILD_CARD)) {
      return true;
    }
  }
  return false;
}
/* LIKE_CONTAINS %ABC% */
export function isLikeContains(value: string): boolean {
  if (value && value.length) {
    value = soqlStringLiteralToDisplayValue(value);
    if (value.startsWith(WILD_CARD) && value.endsWith(WILD_CARD)) {
      return true;
    }
  }
  return false;
}

export function addWildCardToValue(operatorValue: UiOperatorValue, rawValue: string): string {
  let value = stripWildCardPadding(rawValue);
  switch (operatorValue) {
    case UiOperatorValue.LIKE_START:
      value = `${value}${WILD_CARD}`;
      break;
    case UiOperatorValue.LIKE_END:
      value = `${WILD_CARD}${value}`;
      break;
    case UiOperatorValue.LIKE_CONTAINS:
      value = `${WILD_CARD}${value}${WILD_CARD}`;
      break;
    default:
      break;
  }
  return value;
}

export function stripWildCardPadding(rawStr: string): string {
  let value = rawStr;
  value = trimWildCardRight(value);
  value = trimWildCardLeft(value);
  return value;
}

function trimWildCardLeft(rawStr: string): string {
  if (!rawStr.startsWith(WILD_CARD)) {
    return rawStr;
  }
  return trimWildCardLeft(rawStr.substring(1));
}

function trimWildCardRight(rawStr: string): string {
  if (!rawStr.endsWith(WILD_CARD)) {
    return rawStr;
  }
  return trimWildCardRight(rawStr.substring(0, rawStr.length - 1));
}
