/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Condition, SyntaxOptions, Where } from '../model';

export class WhereImpl implements Where {
  constructor(public condition: Condition) {}

  public toSoqlSyntax(options?: SyntaxOptions): string {
    return `WHERE ${this.condition.toSoqlSyntax(options)}`;
  }
}
