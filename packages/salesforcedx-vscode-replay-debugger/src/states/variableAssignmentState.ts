/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Variable } from 'vscode-debugadapter';
import { LogContext } from '../core/logContext';
import { DebugLogState } from './debugLogState';

export class VariableAssignmentState implements DebugLogState {
  private fields: string[];

  constructor(fields: string[]) {
    this.fields = fields;
  }
  public handle(logContext: LogContext): boolean {
    const currFrame = logContext.getTopFrame();
    if (currFrame) {
      const id = currFrame.id;
      const frameInfo = logContext.getFrameHandler().get(id);
      if (logContext.getFrames().length > 1) {
        const frames = logContext.getFrames();
        const prevId = frames[frames.length - 2].id;
        const prevFrame = logContext.getFrameHandler().get(prevId);
        frameInfo.statics = prevFrame.statics;
      }
      const name = this.fields[3];
      const value = this.fields[4];
      const addr = Boolean(this.fields[5]);
      if (frameInfo.statics.has(name)) {
        frameInfo.statics.set(name, new Variable(name, value));
      } else if (name.indexOf('.') !== -1) {
        frameInfo.globals.set(name, new Variable(name, value));
      } else {
        frameInfo.locals.set(name, new Variable(name, value));
      }
    }

    return false;
  }
}
