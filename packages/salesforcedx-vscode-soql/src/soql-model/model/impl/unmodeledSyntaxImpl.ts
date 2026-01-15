/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Soql from '../model';
import { UnmodeledSyntaxReason } from '../unmodeled';
import { SoqlModelObjectImpl } from './soqlModelObjectImpl';

export class UnmodeledSyntaxImpl extends SoqlModelObjectImpl implements Soql.UnmodeledSyntax {
  constructor(public unmodeledSyntax: string, public reason: UnmodeledSyntaxReason) {
    super();
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public toSoqlSyntax(options?: Soql.SyntaxOptions): string {
    return this.unmodeledSyntax;
  }
}
