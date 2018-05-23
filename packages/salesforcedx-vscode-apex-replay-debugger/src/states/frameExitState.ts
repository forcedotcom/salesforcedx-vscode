/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LogContext } from '../core/logContext';
import { DebugLogState } from './debugLogState';
import { FrameState } from './frameState';

export class FrameExitState extends FrameState implements DebugLogState {
  constructor(fields: string[]) {
    super(fields);
  }

  public handle(logContext: LogContext): boolean {
    while (logContext.hasFrames()) {
      const topFrame = logContext.getTopFrame();
      if (topFrame) {
        logContext.getFrames().pop();
        if (
          topFrame.name === this._frameName ||
          topFrame.name.startsWith(this._frameName)
        ) {
          break;
        }
      }
    }
    return false;
  }
}
