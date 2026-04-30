/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AndOr, AndOrCondition, Condition, SyntaxOptions } from '../model';

export class AndOrConditionImpl implements AndOrCondition {
  public readonly kind = 'andOr' as const;
  constructor(
    public leftCondition: Condition,
    public andOr: AndOr,
    public rightCondition: Condition
  ) {}
  public toSoqlSyntax(options?: SyntaxOptions): string {
    return `${this.leftCondition.toSoqlSyntax(options)} ${this.andOr} ${this.rightCondition.toSoqlSyntax(options)}`;
  }
}
