/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Condition, NestedCondition, SyntaxOptions } from '../model';

export class NestedConditionImpl implements NestedCondition {
  public condition: Condition;
  constructor(condition: Condition) {
    this.condition = condition;
  }
  public toSoqlSyntax(options?: SyntaxOptions): string {
    return `( ${this.condition.toSoqlSyntax(options)} )`;
  }
}
