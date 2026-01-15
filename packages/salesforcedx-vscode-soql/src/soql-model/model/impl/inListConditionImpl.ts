/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Soql from '../model';
import { SoqlModelObjectImpl } from './soqlModelObjectImpl';

export class InListConditionImpl extends SoqlModelObjectImpl implements Soql.InListCondition {
  constructor(
    public field: Soql.Field,
    public operator: Soql.ConditionOperator,
    public values: Soql.CompareValue[]
  ) {
    super();
  }
  public toSoqlSyntax(options?: Soql.SyntaxOptions): string {
    let valuesSyntax = '';
    this.values.forEach((value) => (valuesSyntax = `${valuesSyntax}, ${value.toSoqlSyntax(options)}`));
    if (valuesSyntax.length > 2) {
      // remove comma separator at start of string
      valuesSyntax = valuesSyntax.substring(2);
    }
    return `${this.field.toSoqlSyntax(options)} ${this.operator} ( ${valuesSyntax} )`;
  }
}
