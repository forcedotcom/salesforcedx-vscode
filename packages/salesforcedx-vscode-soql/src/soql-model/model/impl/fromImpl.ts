/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { From, SyntaxOptions, UnmodeledSyntax } from '../model';
import { SoqlModelObjectImpl } from './soqlModelObjectImpl';

export class FromImpl extends SoqlModelObjectImpl implements From {
  public sobjectName: string;
  public as?: UnmodeledSyntax;
  public using?: UnmodeledSyntax;
  constructor(sobjectName: string, as?: UnmodeledSyntax, using?: UnmodeledSyntax) {
    super();
    this.sobjectName = sobjectName;
    this.as = as;
    this.using = using;
  }
  public toSoqlSyntax(options?: SyntaxOptions): string {
    let syntax = `FROM ${this.sobjectName}`;
    if (this.as) {
      syntax += ` ${this.as.toSoqlSyntax(options)}`;
    }
    if (this.using) {
      syntax += ` ${this.using.toSoqlSyntax(options)}`;
    }
    return syntax;
  }
}
