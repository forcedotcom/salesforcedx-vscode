/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Literal, SyntaxOptions } from '../model';

export class LiteralImpl implements Literal {
  constructor(public value: string) { }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public toSoqlSyntax(options?: SyntaxOptions): string {
    return this.value;
  }
}
