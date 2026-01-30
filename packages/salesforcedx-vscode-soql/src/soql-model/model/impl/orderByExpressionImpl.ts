/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Field, NullsOrder, Order, OrderByExpression, SyntaxOptions } from '../model';
import { SoqlModelObjectImpl } from './soqlModelObjectImpl';

export class OrderByExpressionImpl extends SoqlModelObjectImpl implements OrderByExpression {
  constructor(
    public field: Field,
    public order?: Order,
    public nullsOrder?: NullsOrder
  ) {
    super();
  }

  public toSoqlSyntax(options?: SyntaxOptions): string {
    let syntax: string = this.field.toSoqlSyntax(options);
    if (this.order) {
      syntax = `${syntax  } ${this.order}`;
    }
    if (this.nullsOrder) {
      syntax = `${syntax  } ${this.nullsOrder}`;
    }
    return syntax;
  }
}
