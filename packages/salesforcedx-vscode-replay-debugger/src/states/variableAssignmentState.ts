/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ApexVariableContainer,
  VariableContainer
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
      let container: ApexVariableContainer | undefined;
      let map: Map<String, VariableContainer> | undefined;

      if (ref && !logContext.getRefsMap().has(ref)) {
        logContext
          .getRefsMap()
          .set(ref, new ApexVariableContainer('', '', '', ref));
      }
      if (logContext.getStaticVariablesClassMap().has(className)) {
        map = logContext.getStaticVariablesClassMap().get(className)!;
        container = map.get(varName)! as ApexVariableContainer;
      } else if (frameInfo.locals.has(varName)) {
        // if name does not contain '.' (i.e. this.attr or a.Name), it should be in locals and we can update the value
        map = frameInfo.locals;
        container = map.get(varName) as ApexVariableContainer;
      }

      if (
        container &&
        map &&
        container.variablesRef !== 0 &&
        !logContext.getRefsMap().has(ref)
      ) {
        container = new ApexVariableContainer(
          container.name,
          '',
          container.type
        );
        map.set(varName, container);
      }

      if (container) {
        container.value = value;
      }

      // assigning to top level variable in locals
      if (
        ref !== '0' &&
        container &&
        !container.type.startsWith('Map<') &&
        !container.type.startsWith('List<') &&
        !container.type.startsWith('Set<')
      ) {
        // get ref container and map container's variables to the container's
        const refContainer = logContext.getRefsMap().get(ref)!;
        container.variables = refContainer.variables;
        container.variablesRef = refContainer.variablesRef;
        container.name = varName;
        if (value.indexOf('{') === 0 && value !== '{}') {
          container.value = '';
          container.variablesRef = logContext
            .getVariableHandler()
            .create(container);
          this.parseAndPopulate(value, container, logContext);
        } else if (logContext.getRefsMap().has(value)) {
          const rc = logContext.getRefsMap().get(value)!;
          const tmpContainer = new ApexVariableContainer(
            varName,
            rc.value,
            rc.type,
            rc.ref
          );
          tmpContainer.variables = rc.variables;
          tmpContainer.variablesRef = logContext
            .getVariableHandler()
            .create(tmpContainer);
          container.variables.set(varName, tmpContainer);
        }
        // assigning to variable's fields, currently only going to work for a variable in local
      } else if (name.indexOf('.') !== -1 && ref !== '0') {
        container = frameInfo.locals.get(
          nameSplit[nameSplit.length - 2]
        )! as ApexVariableContainer;
        if (container) {
          container.value = '';
          if (container.variablesRef === 0) {
            container.variablesRef = logContext
              .getVariableHandler()
              .create(container);
          }
          if (value.indexOf('{') !== -1 && value !== '{}') {
            const topLevel = new ApexVariableContainer(varName, '', '');
            container.variables.set(varName, topLevel);
            topLevel.variablesRef = logContext
              .getVariableHandler()
              .create(topLevel);
            this.parseAndPopulate(value, topLevel, logContext);
          } else {
            if (logContext.getRefsMap().has(value)) {
              const refContainer = logContext.getRefsMap().get(value)!;
              const tmpContainer = new ApexVariableContainer(
                varName,
                refContainer.value,
                refContainer.type,
                refContainer.ref
              );
              tmpContainer.variables = refContainer.variables;
              tmpContainer.variablesRef = logContext
                .getVariableHandler()
                .create(tmpContainer);
              container.variables.set(varName, tmpContainer);
              if (container.variablesRef === 0) {
                container.variablesRef = logContext
                  .getVariableHandler()
                  .create(container);
              }
            } else {
              container.variables.set(
                varName,
                new ApexVariableContainer(varName, value, '')
              );
            }
          }
        }
      }
    }
    return false;
  }

  private parseAndPopulate(
    value: string,
    container: ApexVariableContainer,
    logContext: LogContext
  ) {
    try {
      const obj = JSON.parse(value);
      Object.keys(obj).forEach(key => {
        if (logContext.getRefsMap().has(String(obj[key]))) {
          const refContainer = logContext.getRefsMap().get(String(obj[key]))!;
          const tmpContainer = new ApexVariableContainer(
            key,
            refContainer.value,
            refContainer.type,
            refContainer.ref
          );
          tmpContainer.variables = refContainer.variables;
          tmpContainer.variablesRef = logContext
            .getVariableHandler()
            .create(tmpContainer);
          container.variables.set(key, tmpContainer);
        } else {
          container.variables.set(
            key,
            new ApexVariableContainer(key, String(obj[key]), '')
          );
        }
      });
    } catch (e) {
      container.value = value;
      container.variablesRef = 0;
      container.variables.clear();
    }
  }
}
