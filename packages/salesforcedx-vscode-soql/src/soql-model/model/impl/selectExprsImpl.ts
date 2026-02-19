/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SelectExprs, SelectExpression, SyntaxOptions } from '../model';

export class SelectExprsImpl implements SelectExprs {
  public readonly kind = 'selectExprs' as const;
  public selectExpressions: SelectExpression[];
  constructor(selectExpressions: SelectExpression[]) {
    this.selectExpressions = selectExpressions;
  }
  public toSoqlSyntax(options?: SyntaxOptions): string {
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
