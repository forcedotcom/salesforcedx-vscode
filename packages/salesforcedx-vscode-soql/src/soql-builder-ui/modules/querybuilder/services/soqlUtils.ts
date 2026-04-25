/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return */
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConditionOperator, Query, Select, SelectExprs, UiOperatorValue, UnmodeledSyntax } from '@salesforce/soql-model/model/model';
import { SoqlModelUtils } from '@salesforce/soql-model/model/util';
import { ModelSerializer } from '@salesforce/soql-model/serialization/serializer';
import { deserialize } from '@salesforce/soql-model/serialization/deserializer';
import { FieldCompareConditionImpl } from '@salesforce/soql-model/model/impl/fieldCompareConditionImpl';
import { FieldRefImpl } from '@salesforce/soql-model/model/impl/fieldRefImpl';
import { FieldSelectionImpl } from '@salesforce/soql-model/model/impl/fieldSelectionImpl';
import { FromImpl } from '@salesforce/soql-model/model/impl/fromImpl';
import { HeaderCommentsImpl } from '@salesforce/soql-model/model/impl/headerCommentsImpl';
import { IncludesConditionImpl } from '@salesforce/soql-model/model/impl/includesConditionImpl';
import { InListConditionImpl } from '@salesforce/soql-model/model/impl/inListConditionImpl';
import { LimitImpl } from '@salesforce/soql-model/model/impl/limitImpl';
import { LiteralImpl } from '@salesforce/soql-model/model/impl/literalImpl';
import { OrderByExpressionImpl } from '@salesforce/soql-model/model/impl/orderByExpressionImpl';
import { OrderByImpl } from '@salesforce/soql-model/model/impl/orderByImpl';
import { QueryImpl } from '@salesforce/soql-model/model/impl/queryImpl';
import { SelectCountImpl } from '@salesforce/soql-model/model/impl/selectCountImpl';
import { UnmodeledSyntaxImpl } from '@salesforce/soql-model/model/impl/unmodeledSyntaxImpl';
import { SelectExprsImpl } from '@salesforce/soql-model/model/impl/selectExprsImpl';
import { WhereImpl } from '@salesforce/soql-model/model/impl/whereImpl';
import { SELECT_COUNT, SubqueryJson, ToolingModelJson } from './model';

export const convertSoqlToUiModel = (soql: string): ToolingModelJson => {
  const queryModel = deserialize(soql);
  const uimodel = convertSoqlModelToUiModel(queryModel);
  return uimodel;
};

// eslint-disable-next-line complexity
const convertSoqlModelToUiModel = (queryModel: Query): ToolingModelJson => {
  const unsupported = [];
  const headerComments = queryModel.headerComments ? queryModel.headerComments.text : undefined;

  const selectExprs = queryModel.select && (queryModel.select as SelectExprs).selectExpressions;

  const fields = selectExprs
    ? selectExprs
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

  // Extract subqueries: unmodeled expressions with reason 'unmodeled:semi-join'
  const subqueries: SubqueryJson[] = selectExprs
    ? selectExprs
      .filter(expr => {
        const unmodeled = expr as unknown as UnmodeledSyntax;
        return unmodeled.kind === 'unmodeled' && unmodeled.reason?.reasonCode === 'unmodeled:semi-join';
      })
      .map(expr => {
        const syntax = (expr as unknown as UnmodeledSyntax).unmodeledSyntax;
        return parseSubquerySyntax(syntax);
      })
      .filter((sq): sq is SubqueryJson => sq !== null)
    : [];

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
  // Subqueries are now supported — remove them from the unsupported list
  const filteredUnsupported = unsupported.filter(
    u => u.reason?.reasonCode !== 'unmodeled:semi-join'
  );

  const toolingModelTemplate: ToolingModelJson = {
    headerComments,
    sObject: sObject || '',
    fields: fields || [],
    subqueries: subqueries || [],
    where: where || { conditions: [], andOr: undefined },
    orderBy: orderBy || [],
    limit: limit || '',
    errors: errors || [],
    unsupported: filteredUnsupported || []
  };

  // USEFUL console.log('Soql -> Ui ', JSON.stringify(toolingModelTemplate.orderBy));

  return toolingModelTemplate;
};

export const convertUiModelToSoql = (uiModel: ToolingModelJson): string => {
  const soqlModel = convertUiModelToSoqlModel(uiModel);
  const soql = convertSoqlModelToSoql(soqlModel);
  return soql;
};

const convertUiModelToSoqlModel = (uiModel: ToolingModelJson): Query => {
  let select: Select;
  const isSelectCount = uiModel.fields.length === 1 && uiModel.fields[0].toLowerCase() === SELECT_COUNT.toLowerCase();
  if (isSelectCount) {
    select = new SelectCountImpl();
  } else {
    const fieldExprs = uiModel.fields.map(field => new FieldSelectionImpl(new FieldRefImpl(field)));
    const subqueryExprs = (uiModel.subqueries || [])
      .filter(sq => sq.fields.length > 0)
      .map(sq => new UnmodeledSyntaxImpl(buildSubquerySyntax(sq), { reasonCode: 'unmodeled:semi-join', message: '' }));
    select = new SelectExprsImpl([...fieldExprs, ...subqueryExprs]);
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
};

const convertSoqlModelToSoql = (soqlModel: Query): string => {
  const serializer = new ModelSerializer(soqlModel);
  const query = serializer.serialize();
  return query;
};

// Parse a raw subquery string like "(SELECT Id, Name FROM Contacts)" into SubqueryJson.
// Returns null if the syntax can't be parsed.
const parseSubquerySyntax = (syntax: string): SubqueryJson | null => {
  const trimmed = syntax.trim().replace(/^\(|\)$/g, '').trim();
  const match = /^SELECT\s+(.+?)\s+FROM\s+(\w+)/i.exec(trimmed);
  if (!match) return null;
  const fields = match[1].split(',').map(f => f.trim()).filter(Boolean);
  const relationshipName = match[2];
  return { relationshipName, fields };
};

// Build a subquery string from SubqueryJson, e.g. "(SELECT Id, Name FROM Contacts)".
const buildSubquerySyntax = (sq: SubqueryJson): string =>
  `(SELECT ${sq.fields.join(', ')} FROM ${sq.relationshipName})`;

export const soqlStringLiteralToDisplayValue = (soqlString: string): string => {
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
};

export const displayValueToSoqlStringLiteral = (displayString: string): string => {
  // string
  let normalized = displayString;

  // escape
  normalized = normalized.replace(/\\/g, '\\\\');
  normalized = normalized.replace(/'/g, "\\'");
  normalized = normalized.replace(/"/g, '\\"');

  // quote
  normalized = `'${normalized}'`;

  return normalized;
};

/* ======= LIKE OPERATOR UTILS ======= */
const WILD_CARD = '%';

/* LIKE_START ABC% */
export const isLikeStart = (value: string): boolean => {
  if (value && value.length) {
    value = soqlStringLiteralToDisplayValue(value);
    if (value.endsWith(WILD_CARD) && !value.startsWith(WILD_CARD)) {
      return true;
    }
  }
  return false;
};
/* LIKE_END %ABC */
export const isLikeEnds = (value: string): boolean => {
  if (value && value.length) {
    value = soqlStringLiteralToDisplayValue(value);
    if (value.startsWith(WILD_CARD) && !value.endsWith(WILD_CARD)) {
      return true;
    }
  }
  return false;
};
/* LIKE_CONTAINS %ABC% */
export const isLikeContains = (value: string): boolean => {
  if (value && value.length) {
    value = soqlStringLiteralToDisplayValue(value);
    if (value.startsWith(WILD_CARD) && value.endsWith(WILD_CARD)) {
      return true;
    }
  }
  return false;
};

export const addWildCardToValue = (operatorValue: UiOperatorValue, rawValue: string): string => {
  let value = stripWildCardPadding(rawValue);
  switch (operatorValue) {
    case 'LIKE_START':
      value = `${value}${WILD_CARD}`;
      break;
    case 'LIKE_END':
      value = `${WILD_CARD}${value}`;
      break;
    case 'LIKE_CONTAINS':
      value = `${WILD_CARD}${value}${WILD_CARD}`;
      break;
    default:
      break;
  }
  return value;
};

export const stripWildCardPadding = (rawStr: string): string => {
  let value = rawStr;
  value = trimWildCardRight(value);
  value = trimWildCardLeft(value);
  return value;
};

const trimWildCardLeft = (rawStr: string): string => {
  if (!rawStr.startsWith(WILD_CARD)) {
    return rawStr;
  }
  return trimWildCardLeft(rawStr.substring(1));
};

const trimWildCardRight = (rawStr: string): string => {
  if (!rawStr.endsWith(WILD_CARD)) {
    return rawStr;
  }
  return trimWildCardRight(rawStr.substring(0, rawStr.length - 1));
};
