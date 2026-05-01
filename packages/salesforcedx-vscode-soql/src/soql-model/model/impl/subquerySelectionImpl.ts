/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SubquerySelection, SyntaxOptions } from '../model';

export class SubquerySelectionImpl implements SubquerySelection {
  public readonly kind = 'subquerySelection' as const;

  constructor(
    public sobjectName: string,
    public fields: string[],
    public subqueries: SubquerySelection[] = []
  ) {}

  public toSoqlSyntax(options?: SyntaxOptions): string {
    const allExpressions = [
      ...this.fields,
      ...this.subqueries.map(sq => sq.toSoqlSyntax(options))
    ];

    return `(SELECT ${allExpressions.join(', ')} FROM ${this.sobjectName})`;
  }
}
