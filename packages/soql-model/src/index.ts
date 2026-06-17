/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export {
  AndOr,
  ConditionOperator,
  REASON_UNMODELED_COMPLEXGROUP,
  REASON_UNMODELED_FUNCTIONREFERENCE,
  REASON_UNMODELED_GROUPBY,
  SObjectFieldType
} from './model/model';
export type { ErrorType, LiteralType, Query, Select, SelectExprs, UiOperatorValue } from './model/model';
export { SoqlModelUtils } from './model/util';

export { FieldCompareConditionImpl } from './model/impl/fieldCompareConditionImpl';
export { FieldRefImpl } from './model/impl/fieldRefImpl';
export { FieldSelectionImpl } from './model/impl/fieldSelectionImpl';
export { FromImpl } from './model/impl/fromImpl';
export { HeaderCommentsImpl } from './model/impl/headerCommentsImpl';
export { IncludesConditionImpl } from './model/impl/includesConditionImpl';
export { InListConditionImpl } from './model/impl/inListConditionImpl';
export { LimitImpl } from './model/impl/limitImpl';
export { LiteralImpl } from './model/impl/literalImpl';
export { OrderByExpressionImpl } from './model/impl/orderByExpressionImpl';
export { OrderByImpl } from './model/impl/orderByImpl';
export { QueryImpl } from './model/impl/queryImpl';
export { SelectCountImpl } from './model/impl/selectCountImpl';
export { SelectExprsImpl } from './model/impl/selectExprsImpl';
export { WhereImpl } from './model/impl/whereImpl';

export { SelectAnalyzer } from './analyzers/selectAnalyzer';
export type { ColumnData } from './analyzers/selectAnalyzer';

export { ModelSerializer } from './serialization/serializer';
export { deserialize } from './serialization/deserializer';

export {
  getFieldInputValidator,
  getFieldMultipleInputValidator,
  getOperatorValidator
} from './validators/validatorFactory';
export { splitMultiInputValues } from './validators/inputUtils';
