/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SoqlModelObject, SyntaxOptions } from '../model/model';

export class ModelSerializer {
  protected model: SoqlModelObject;

  constructor(model: SoqlModelObject) {
    this.model = model;
  }
  public serialize(options?: SyntaxOptions): string {
    return this.model.toSoqlSyntax(options);
  }
}
