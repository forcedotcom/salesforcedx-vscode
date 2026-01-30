/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConditionOperator, CompareValue, Field, FieldCompareCondition, SyntaxOptions } from '../model';
import { SoqlModelObjectImpl } from './soqlModelObjectImpl';

export class FieldCompareConditionImpl extends SoqlModelObjectImpl implements FieldCompareCondition {
  constructor(
    public field: Field,
    public operator: ConditionOperator,
    public compareValue: CompareValue
  ) {
    super();
  }
  public toSoqlSyntax(options?: SyntaxOptions): string {
    return `${this.field.toSoqlSyntax(options)} ${this.operator} ${this.compareValue.toSoqlSyntax(options)}`;
  }
}
