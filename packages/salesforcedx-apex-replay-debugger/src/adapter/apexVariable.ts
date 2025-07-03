/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Variable } from '@vscode/debugadapter';

export class ApexVariable extends Variable {
  public readonly type: string;
  public readonly apexRef: string | undefined;
  public readonly evaluateName: string;

  constructor(name: string, value: string, type: string, ref = 0, apexRef?: string) {
    super(name, value, ref);
    this.type = type;
    this.apexRef = apexRef;
    this.evaluateName = value;
  }
}
