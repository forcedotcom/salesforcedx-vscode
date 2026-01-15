/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Soql from '../model';

export abstract class SoqlModelObjectImpl {
  public getSyntaxOptions(options?: Soql.SyntaxOptions): Soql.SyntaxOptions {
    return options ? options : new Soql.SyntaxOptions();
  }
}
