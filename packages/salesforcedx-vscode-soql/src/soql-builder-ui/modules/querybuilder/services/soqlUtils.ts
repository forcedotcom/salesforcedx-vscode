/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return */
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConditionOperator, Query, Select, SelectExprs, SubquerySelection, UiOperatorValue } from '@salesforce/soql-model/model/model';
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
import { SelectExprsImpl } from '@salesforce/soql-model/model/impl/selectExprsImpl';
import { SubquerySelectionImpl } from '@salesforce/soql-model/model/impl/subquerySelectionImpl';
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

  const allFieldNames = selectExprs
    ? selectExprs
      .filter(expr => expr.kind === 'fieldSelection' && !SoqlModelUtils.containsUnmodeledSyntax(expr))
      .map(expr => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (expr.field.fieldName) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-member-access
          return expr.field.fieldName as string;
        }
        return undefined;
      })
      .filter((f): f is string => !!f)
    : [SELECT_COUNT];

  // Separate plain fields from dotted relationship fields (e.g. "Account.Name")
  const fields = allFieldNames.filter(f => !f.includes('.'));

  // Group dotted fields into relationships: [{relationshipName: 'Account', fields: ['Id','Name']}]
  const relationshipMap = new Map<string, string[]>();
  allFieldNames.filter(f => f.includes('.')).forEach(f => {
    const dot = f.indexOf('.');
    const relName = f.slice(0, dot);
    const fieldName = f.slice(dot + 1);
    if (!relationshipMap.has(relName)) relationshipMap.set(relName, []);
    relationshipMap.get(relName).push(fieldName);
  });
  const relationships: SubqueryJson[] = Array.from(relationshipMap.entries()).map(
    ([relationshipName, relFields]) => ({ relationshipName, fields: relFields })
  );

  // Extract subqueries from properly-modeled SubquerySelection expressions
  const subqueries: SubqueryJson[] = selectExprs
    ? selectExprs
      .filter(expr => expr.kind === 'subquerySelection')
      .map(expr => subquerySelectionToJson(expr as unknown as SubquerySelection))
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
            condition: normalizeCondition(condition),
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
  const filteredUnsupported = unsupported;

  const toolingModelTemplate: ToolingModelJson = {
    headerComments,
    sObject: sObject || '',
    fields: fields || [],
    relationships: relationships || [],
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
    const relationshipExprs = (uiModel.relationships || []).flatMap(rel =>
      rel.fields.map(f => new FieldSelectionImpl(new FieldRefImpl(`${rel.relationshipName}.${f}`)))
    );
    const subqueryExprs = (uiModel.subqueries || [])
      .filter(sq => sq.fields.length > 0 || (sq.subqueries || []).length > 0)
      .map(sq => subqueryJsonToImpl(sq));
    select = new SelectExprsImpl([...fieldExprs, ...relationshipExprs, ...subqueryExprs]);
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

// Convert a SubquerySelection model node to SubqueryJson (recursive).
const subquerySelectionToJson = (sel: SubquerySelection): SubqueryJson => ({
  relationshipName: sel.sobjectName,
  fields: sel.fields,
  subqueries: (sel.subqueries || []).map(subquerySelectionToJson)
});

// Convert SubqueryJson back to a SubquerySelectionImpl (recursive).
const subqueryJsonToImpl = (sq: SubqueryJson): SubquerySelectionImpl =>
  new SubquerySelectionImpl(
    sq.relationshipName,
    sq.fields,
    (sq.subqueries || []).map(subqueryJsonToImpl)
  );

// Infer the LiteralType for a raw SOQL literal value string.
const inferLiteralType = (value: string): string => {
  if (value === 'true' || value === 'false') return 'BOOLEAN';
  if (value === 'null') return 'NULL';
  if (/^-?\d+(\.\d+)?$/.test(value)) return 'NUMBER';
  if (/^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/.test(value)) return 'DATE';
  return 'STRING';
};

// Normalize a raw parsed condition to match the shape expected by whereModifierGroup's condition setter.
// Specifically, adds `type` to `compareValue` and `values` entries so the criteria display value loads correctly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeCondition = (condition: any): any => {
  if (!condition) return condition;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (condition.compareValue && condition.compareValue.value !== undefined && !condition.compareValue.type) {
    return {
      ...condition,
      compareValue: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        type: inferLiteralType(condition.compareValue.value),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        value: condition.compareValue.value
      }
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (Array.isArray(condition.values)) {
    return {
      ...condition,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      values: condition.values.map((v: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
        v.type ? v : { type: inferLiteralType(v.value), value: v.value }
      )
    };
  }
  return condition;
};

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
