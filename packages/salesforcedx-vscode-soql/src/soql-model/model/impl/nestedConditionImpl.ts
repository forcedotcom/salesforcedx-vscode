/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Soql from '../model';
import { SoqlModelObjectImpl } from './soqlModelObjectImpl';

export class NestedConditionImpl extends SoqlModelObjectImpl implements Soql.NestedCondition {
  public condition: Soql.Condition;
  constructor(condition: Soql.Condition) {
    super();
    this.condition = condition;
  }
  public toSoqlSyntax(options?: Soql.SyntaxOptions): string {
    return `( ${this.condition.toSoqlSyntax(options)} )`;
  }
}
