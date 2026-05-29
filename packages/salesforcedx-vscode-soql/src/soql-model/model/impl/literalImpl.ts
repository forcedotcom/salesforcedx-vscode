/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Literal, LiteralType, SyntaxOptions } from '../model';

export class LiteralImpl implements Literal {
  public readonly kind = 'literal' as const;
  constructor(
    public type: LiteralType,
    public value: string
  ) {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public toSoqlSyntax(options?: SyntaxOptions): string {
    return this.value;
  }
}
