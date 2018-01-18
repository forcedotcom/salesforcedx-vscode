/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LogContext } from '../core/logContext';
import { DebugLogState } from './debugLogState';

export class FrameExitState implements DebugLogState {
  private readonly signature: string;

  constructor(fields: string[]) {
    this.signature = fields[fields.length - 1];
  }

  public handle(logContext: LogContext): boolean {
    const topFrame = logContext.getTopFrame();
    if (topFrame && (topFrame.name === this.signature || topFrame.name.startsWith(this.signature))) {
      logContext.getFrames().pop();
    }
    return false;
  }
}
