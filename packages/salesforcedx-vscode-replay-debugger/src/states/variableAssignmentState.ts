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
        name.indexOf('.') > -1 ? name.substring(0, name.lastIndexOf('.')) : '';
      const varName =
        nameSplit.length > 0 ? nameSplit[nameSplit.length - 1] : name;
      const value = this.fields[4];
      let ref;
      if (this.fields.length === 6) {
        ref = this.fields[5];
      }

      const refMap = logContext.getRefsMap();
      let container: ApexVariableContainer | undefined;
      let map: Map<String, VariableContainer> | undefined;
      let isNested = false;

      if (logContext.getStaticVariablesClassMap().has(className)) {
        map = logContext.getStaticVariablesClassMap().get(className)!;
        container = map.get(varName)! as ApexVariableContainer;
      } else if (frameInfo.locals.has(varName)) {
        // if name does not contain '.' (i.e. this.attr or a.Name), it should be in locals and we can update the value
        map = frameInfo.locals;
        container = map.get(varName) as ApexVariableContainer;
      } else if (name.indexOf('.') !== -1) {
        isNested = true;
        map = frameInfo.locals;
        container = map.get(
          nameSplit[nameSplit.length - 2]
        ) as ApexVariableContainer;
        if (ref && container.ref !== ref) {
          container = undefined;
        }
      }

      if (ref) {
        // update the refcontainer mapping
        if (!refMap.has(ref)) {
          logContext
            .getRefsMap()
            .set(ref, new ApexVariableContainer('', '', '', ref));
        }
        const refContainer = refMap.get(ref)!;
        if (value !== '{}') {
          if (isNested && value.indexOf('{') === 0) {
            const topLevel = new ApexVariableContainer(varName, '', '');
            refContainer.variables.set(varName, topLevel);
            topLevel.variablesRef = logContext
              .getVariableHandler()
              .create(topLevel);
            this.parseJSONAndPopulate(value, topLevel, logContext);
          } else if (value.indexOf('{') === 0) {
            this.parseJSONAndPopulate(value, refContainer, logContext);
          } else {
            refContainer.variables.set(
              varName,
              new ApexVariableContainer(varName, value, '')
            );
          }
        }

        // update the correct toplevel container
        if (
          container &&
          !container.type.startsWith('Map<') &&
          !container.type.startsWith('List<') &&
          !container.type.startsWith('Set<')
        ) {
          container.ref = ref;
          container.value = '';
          container.variables = refContainer.variables;
          refContainer.type = container.type;
          if (value !== '{}' && container.variablesRef === 0) {
            container.variablesRef = logContext
              .getVariableHandler()
              .create(container);
          } else if (value === '{}') {
            container.value = value;
          }
        }
      } else {
        if (container) {
          container.value = value;
        }
      }
    }
    return false;
  }

  private parseJSONAndPopulate(
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
