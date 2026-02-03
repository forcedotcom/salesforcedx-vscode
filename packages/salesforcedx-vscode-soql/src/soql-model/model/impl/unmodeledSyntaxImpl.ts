/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SyntaxOptions, UnmodeledSyntax } from '../model';
import { UnmodeledSyntaxReason } from '../unmodeled';

export class UnmodeledSyntaxImpl implements UnmodeledSyntax {
  constructor(public unmodeledSyntax: string, public reason: UnmodeledSyntaxReason) { }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public toSoqlSyntax(options?: SyntaxOptions): string {
    return this.unmodeledSyntax;
  }
}
