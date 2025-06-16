/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ApexVariableContainer } from '../adapter/variableContainer';
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
      const frameInfo = logContext.getFrameHandler().get(currFrame.id);
      const name = this.fields[3];
      const type = this.fields[4];
      const className = logContext.getUtil().substringUpToLastPeriod(name);
      if (className && !logContext.getStaticVariablesClassMap().has(className)) {
        logContext.getStaticVariablesClassMap().set(className, new Map<string, ApexVariableContainer>());
      }
      const statics = logContext.getStaticVariablesClassMap().get(className)!;
      if (this.fields[6] === 'true') {
        // will need to use the last index in case of something like OuterClass.InnerClass.method()
        const varName = logContext.getUtil().substringFromLastPeriod(name);
        statics.set(varName, new ApexVariableContainer(varName, 'null', type));
      } else {
        // had to add this check because triggers will have variable assignments show up twice and break this
        if (frameInfo && !frameInfo.locals.has(name)) {
          frameInfo.locals.set(name, new ApexVariableContainer(name, 'null', type));
        }
      }
    }

    return false;
  }
}
