/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Soql from '../model';
import { SoqlModelObjectImpl } from './soqlModelObjectImpl';

export class FieldSelectionImpl extends SoqlModelObjectImpl implements Soql.FieldSelection {
  public field: Soql.Field;
  public alias?: Soql.UnmodeledSyntax;
  constructor(field: Soql.Field, alias?: Soql.UnmodeledSyntax) {
    super();
    this.field = field;
    this.alias = alias;
  }

  public toSoqlSyntax(options?: Soql.SyntaxOptions): string {
    return this.alias ? `${this.field.toSoqlSyntax()} ${this.alias.toSoqlSyntax(options)}` : this.field.toSoqlSyntax();
  }
}
