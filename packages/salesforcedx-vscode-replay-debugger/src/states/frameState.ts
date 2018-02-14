/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { FrameStateUtil } from './frameStateUtil';

export abstract class FrameState {
  protected readonly _signature: string;
  protected readonly _frameName: string;

  constructor(fields: string[]) {
    this._signature = fields[fields.length - 1];
    this._frameName = FrameStateUtil.computeFrameName(fields);
  }
}
