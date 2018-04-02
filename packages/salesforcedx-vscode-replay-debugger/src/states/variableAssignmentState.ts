/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ApexVariableContainer } from '../adapter/apexReplayDebug';
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
        // if name does not contain '.' (i.e. this.attr or a.Name), it should be in locals and we can update the value
        const localVariableContainer = frameInfo.locals.get(
          varName
        ) as ApexVariableContainer;
        // if a local var is a reference, should be in locals already
        if (ref !== '0') {
          if (!logContext.getRefsMap().has(ref)) {
            logContext.getRefsMap().set(ref, localVariableContainer);
          } else {
            // if the ref already exists then that means we are assigning another pointer to a ref so we need to merge the info from the ref into the variable container
            Object.assign(
              localVariableContainer,
              logContext.getRefsMap().get(ref)
            );
            localVariableContainer.name = varName;
          }
          localVariableContainer.variablesRef = logContext
            .getVariableHandler()
            .create(localVariableContainer);
          if (value.indexOf('{') !== -1 && value !== '{}') {
            const containers = this.getVars(value);
            containers.forEach(container => {
              localVariableContainer.variables.set(container.name, container);
            });
          }
        }
        // if normal local var then update varcontainer since it should be in locals
        localVariableContainer.value = value;
      } else if (name.indexOf('.') !== -1 && ref !== '0') {
        const container = logContext.getRefsMap().get(ref)!;
        if (container) {
          container.variables.set(
            varName,
            new ApexVariableContainer(varName, value, '')
          );
        }
      }
    }

    return false;
  }

  private getVars(value: string): ApexVariableContainer[] {
    // str.replace(/([a-zA-Z0-9-]+):([a-zA-Z0-9-]+)/g, "\"$1\":\"$2\"");
    // "{"changeThis": 10,"nsInstanceBlob": BLOB(5 bytes),"nsInstanceDub": 2.4,"nsInstanceInt": 5,"nsInstanceStr": "inDevNs anotherNSCla (2 more) ..."}"
    const keyValues = value
      .replace(/{/, '')
      .replace(/}/, '')
      .replace(/['"]+/g, '')
      .split(',');
    const varList: ApexVariableContainer[] = [];
    keyValues.forEach(pair => {
      const name = pair.split(':')[0];
      const val = pair.split(':')[1];
      varList.push(new ApexVariableContainer(name, val, ''));
    });
    return varList;
  }
}
