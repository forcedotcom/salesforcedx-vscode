/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SFDC_TRIGGER } from '../constants';

export class FrameState {
  protected readonly signature: string;
  protected readonly frameName: string;

  constructor(fields: string[]) {
    this.signature = fields[fields.length - 1];
    if (this.signature.startsWith(SFDC_TRIGGER)) {
      this.frameName = this.signature.substring(SFDC_TRIGGER.length);
    } else {
      this.frameName = this.signature;
    }
  }
}
