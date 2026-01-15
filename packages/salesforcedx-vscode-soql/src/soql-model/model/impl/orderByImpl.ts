/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Soql from '../model';
import { SoqlModelObjectImpl } from './soqlModelObjectImpl';

export class OrderByImpl extends SoqlModelObjectImpl implements Soql.OrderBy {
  public orderByExpressions: Soql.OrderByExpression[];

  constructor(orderByExpressions: Soql.OrderByExpression[]) {
    super();
    this.orderByExpressions = orderByExpressions;
  }

  public toSoqlSyntax(options?: Soql.SyntaxOptions): string {
    let syntax = 'ORDER BY ';
    let first = true;
    if (this.orderByExpressions.length > 0) {
      this.orderByExpressions.forEach((orderByExpressions) => {
        if (!first) {
          syntax += ', ';
        }
        syntax += orderByExpressions.toSoqlSyntax(options);
        first = false;
      });
    } else {
      syntax += '';
    }
    return syntax;
  }
}
