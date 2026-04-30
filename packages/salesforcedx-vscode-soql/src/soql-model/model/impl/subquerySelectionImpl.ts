/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Limit, OrderBy, SubquerySelection, SyntaxOptions, Where } from '../model';

export class SubquerySelectionImpl implements SubquerySelection {
  public readonly kind = 'subquerySelection' as const;

  constructor(
    public sobjectName: string,
    public fields: string[],
    public subqueries: SubquerySelection[] = [],
    public where?: Where,
    public orderBy?: OrderBy,
    public limit?: Limit
  ) {}

  public toSoqlSyntax(options?: SyntaxOptions): string {
    const allExpressions = [
      ...this.fields,
      ...this.subqueries.map(sq => sq.toSoqlSyntax(options))
    ];

    let soql = `(SELECT ${allExpressions.join(', ')} FROM ${this.sobjectName}`;
    if (this.where) {
      soql += ` ${this.where.toSoqlSyntax(options)}`;
    }
    if (this.orderBy) {
      soql += ` ${this.orderBy.toSoqlSyntax(options)}`;
    }
    if (this.limit) {
      soql += ` ${this.limit.toSoqlSyntax(options)}`;
    }
    soql += ')';
    return soql;
  }
}
