/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Soql from '../model';
import { SoqlModelObjectImpl } from './soqlModelObjectImpl';

export class WhereImpl extends SoqlModelObjectImpl implements Soql.Where {
  constructor(public condition: Soql.Condition) {
    super();
  }
  public toSoqlSyntax(options?: Soql.SyntaxOptions): string {
    return `WHERE ${this.condition.toSoqlSyntax(options)}`;
  }
}
