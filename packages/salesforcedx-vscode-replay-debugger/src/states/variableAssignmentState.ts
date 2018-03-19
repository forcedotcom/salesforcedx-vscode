/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ApexVariable,
  ApexVariableContainer
} from '../adapter/apexReplayDebug';
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
      const name = this.fields[3];
      const nameSplit = this.fields[3].split('.');
      const className =
        name.indexOf('.') > -1
          ? name.substring(0, name.lastIndexOf('.'))
          : name;
      const varName =
        nameSplit.length > 0 ? nameSplit[nameSplit.length - 1] : name;
      const value = this.fields[4];
      let ref = '0';
      if (this.fields.length === 6) {
        ref = this.fields[5];
      }
      if (logContext.getStaticVariablesClassMap().has(className)) {
        const statics = logContext.getStaticVariablesClassMap().get(className)!;
        const container = statics.get(name)! as ApexVariableContainer;
        container.value = value;
        if (ref !== '0') {
          container.variablesRef = logContext
            .getVariableHandler()
            .create(container);
        }
      } else if (frameInfo.locals.has(varName)) {
        const localsContainer = frameInfo.locals.get(
          varName
        ) as ApexVariableContainer;
        localsContainer.value = value;
        if (ref !== '0') {
          localsContainer.variablesRef = logContext
            .getVariableHandler()
            .create(localsContainer);
          logContext.getRefsMap().set(ref, localsContainer);
        }
      }
    }

    return false;
  }
}
