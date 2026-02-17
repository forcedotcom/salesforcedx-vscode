/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Limit, SyntaxOptions } from '../model';

export class LimitImpl implements Limit {
  public limit: number;
  constructor(limit: number) {
    this.limit = limit;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public toSoqlSyntax(options?: SyntaxOptions): string {
    return `LIMIT ${this.limit}`;
  }
}
