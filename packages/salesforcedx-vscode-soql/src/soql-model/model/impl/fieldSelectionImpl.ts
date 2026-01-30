/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Field, FieldSelection, SyntaxOptions, UnmodeledSyntax } from '../model';
import { SoqlModelObjectImpl } from './soqlModelObjectImpl';

export class FieldSelectionImpl extends SoqlModelObjectImpl implements FieldSelection {
  public field: Field;
  public alias?: UnmodeledSyntax;
  constructor(field: Field, alias?: UnmodeledSyntax) {
    super();
    this.field = field;
    this.alias = alias;
  }

  public toSoqlSyntax(options?: SyntaxOptions): string {
    return this.alias ? `${this.field.toSoqlSyntax()} ${this.alias.toSoqlSyntax(options)}` : this.field.toSoqlSyntax();
  }
}
