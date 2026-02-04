/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Condition, NotCondition, SyntaxOptions } from '../model';

export class NotConditionImpl implements NotCondition {
  public readonly kind = 'not' as const;
  public condition: Condition;
  constructor(condition: Condition) {
    this.condition = condition;
  }
  public toSoqlSyntax(options?: SyntaxOptions): string {
    return `NOT ${this.condition.toSoqlSyntax(options)}`;
  }
}
