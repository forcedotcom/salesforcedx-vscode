/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { HeaderComments, SyntaxOptions } from '../model';
import { SoqlModelObjectImpl } from './soqlModelObjectImpl';

export class HeaderCommentsImpl extends SoqlModelObjectImpl implements HeaderComments {
  constructor(public text: string) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public toSoqlSyntax(options?: SyntaxOptions): string {
    return this.text || '';
  }
}
