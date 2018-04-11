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
      let container: ApexVariableContainer | undefined;
      if (logContext.getStaticVariablesClassMap().has(className)) {
        const statics = logContext.getStaticVariablesClassMap().get(className)!;
        container = statics.get(name)! as ApexVariableContainer;
      } else if (frameInfo.locals.has(varName)) {
        // if name does not contain '.' (i.e. this.attr or a.Name), it should be in locals and we can update the value
        container = frameInfo.locals.get(varName) as ApexVariableContainer;
      }
      if (container) {
        container.value = value;
      }
      if (
        ref !== '0' &&
        container &&
        !container.type.startsWith('Map<') &&
        !container.type.startsWith('List<') &&
        !container.type.startsWith('Set<')
      ) {
        if (!logContext.getRefsMap().has(ref)) {
          logContext.getRefsMap().set(ref, container);
        } else {
          // if the ref already exists then that means we are assigning another pointer to a ref so we need to merge the info from the ref into the variable container
          const refContainer = logContext.getRefsMap().get(ref)!;
          container.variables = refContainer.variables;
          container.variablesRef = refContainer.variablesRef;
          container.name = varName;
        }
        if (value.indexOf('{') === 0 && value !== '{}') {
          container.value = '';
          container.variablesRef = logContext
            .getVariableHandler()
            .create(container);
          this.parseVars(value, container);
        }
      } else if (name.indexOf('.') !== -1 && ref !== '0') {
        container = logContext.getRefsMap().get(ref)!;
        if (container) {
          if (container.variablesRef === 0) {
            container.variablesRef = logContext
              .getVariableHandler()
              .create(container);
            container.value = '';
          }
          if (value.indexOf('{') !== -1 && value !== '{}') {
            const topLevel = new ApexVariableContainer(varName, '', '');
            container.variables.set(varName, topLevel);
            topLevel.variablesRef = logContext
              .getVariableHandler()
              .create(topLevel);
            this.parseVars(value, topLevel);
          } else {
            container.variables.set(
              varName,
              new ApexVariableContainer(varName, value, '')
            );
          }
        }
      }
    }

    return false;
  }

  private parseVars(value: string, container: ApexVariableContainer) {
    try {
      const obj = JSON.parse(value);
      Object.keys(obj).forEach(key => {
        container.variables.set(
          key,
          new ApexVariableContainer(key, String(obj[key]), '')
        );
      });
    } catch (e) {
      container.value = value;
      container.variablesRef = 0;
      container.variables.clear();
    }
  }
}
