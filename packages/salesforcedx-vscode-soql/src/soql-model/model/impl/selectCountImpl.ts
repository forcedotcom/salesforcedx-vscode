/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SelectCount, SyntaxOptions } from '../model';

export class SelectCountImpl implements SelectCount {
  public readonly kind = 'selectCount' as const;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, class-methods-use-this
  public toSoqlSyntax(options?: SyntaxOptions): string {
    return 'SELECT COUNT()';
  }
}
