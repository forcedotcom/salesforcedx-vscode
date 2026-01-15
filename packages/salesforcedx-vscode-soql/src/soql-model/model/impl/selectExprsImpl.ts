/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Soql from '../model';
import { SoqlModelObjectImpl } from './soqlModelObjectImpl';

export class SelectExprsImpl extends SoqlModelObjectImpl implements Soql.SelectExprs {
  public selectExpressions: Soql.SelectExpression[];
  constructor(selectExpressions: Soql.SelectExpression[]) {
    super();
    this.selectExpressions = selectExpressions;
  }
  public toSoqlSyntax(options?: Soql.SyntaxOptions): string {
    let syntax = 'SELECT ';
    let first = true;
    if (this.selectExpressions.length > 0) {
      this.selectExpressions.forEach((selectExpression) => {
        if (!first) {
          syntax += ', ';
        }
        syntax += selectExpression.toSoqlSyntax(options);
        first = false;
      });
    } else {
      syntax += '';
    }
    return syntax;
  }
}
