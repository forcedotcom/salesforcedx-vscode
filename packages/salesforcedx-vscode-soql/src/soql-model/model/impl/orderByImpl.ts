/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OrderBy, OrderByExpression, SyntaxOptions } from '../model';
import { SoqlModelObjectImpl } from './soqlModelObjectImpl';

export class OrderByImpl extends SoqlModelObjectImpl implements OrderBy {
  public orderByExpressions: OrderByExpression[];

  constructor(orderByExpressions: OrderByExpression[]) {
    super();
    this.orderByExpressions = orderByExpressions;
  }

  public toSoqlSyntax(options?: SyntaxOptions): string {
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
