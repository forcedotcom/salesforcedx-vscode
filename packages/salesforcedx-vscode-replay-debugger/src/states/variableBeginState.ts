/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Variable } from 'vscode-debugadapter';
import { LogContext } from '../core/logContext';
import { DebugLogState } from './debugLogState';

export class VariableBeginState implements DebugLogState {
  private fields: string[];

  constructor(fields: string[]) {
    this.fields = fields;
  }
  public handle(logContext: LogContext): boolean {
    const currFrame = logContext.getTopFrame();
    if (currFrame) {
      const id = currFrame.id;
      const frameInfo = logContext.getFrameHandler().get(id);
      const name = this.fields[3];
      const type = this.fields[4];
      const isRef = this.fields[5] === 'true';
      const isStatic = this.fields[6] === 'true';
      const className = name.substring(0, name.lastIndexOf('.'));
      if (!logContext.getTypeRefVariablesMap().has(className)) {
        logContext
          .getTypeRefVariablesMap()
          .set(className, new Map<String, Variable>());
      }
      const statics = logContext.getTypeRefVariablesMap().get(className)!;
      if (isStatic) {
        statics.set(name, new Variable(name, ''));
      } else {
        frameInfo.locals.set(name, new Variable(name, ''));
      }
    }

    return false;
  }
}
