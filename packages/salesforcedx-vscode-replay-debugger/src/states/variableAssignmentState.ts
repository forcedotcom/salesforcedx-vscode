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
      const value = this.fields[4].replace(/^"/, "'").replace(/"$/, "'");
      let ref;
      if (this.fields.length === 6) {
        ref = this.fields[5];
      }

      const refMap = logContext.getRefsMap();
      let container: ApexVariableContainer | undefined;
      let map: Map<string, VariableContainer> | undefined;
      let isNested = false;

      // Grab the a top level container from statics or locals if it exists
      if (logContext.getStaticVariablesClassMap().has(className)) {
        map = logContext.getStaticVariablesClassMap().get(className)!;
        container = map.get(varName)! as ApexVariableContainer;
      } else if (frameInfo.locals.has(varName)) {
        map = frameInfo.locals;
        container = map.get(varName) as ApexVariableContainer;
        // if the variable we're given is a child variable, then it will come in the format of this.varName
      } else if (name.indexOf('.') !== -1) {
        isNested = true;
      }

      // update the ref mapping
      if (ref) {
        if (!refMap.has(ref)) {
          logContext
            .getRefsMap()
            .set(ref, new ApexVariableContainer('', '', '', ref));
        }
        const refContainer = refMap.get(ref)!;
        // nested variable will either be given a json or a value
        if (isNested) {
          if (value === '{}') {
            refContainer.variables.set(
              varName,
              new ApexVariableContainer(varName, value, '')
            );
            // if its a json assignment, parse the values
          } else if (value.indexOf('{') === 0) {
            const topLevel = new ApexVariableContainer(varName, '', '');
            refContainer.variables.set(varName, topLevel);
            topLevel.variablesRef = logContext
              .getVariableHandler()
              .create(topLevel);
            this.parseJSONAndPopulate(value, topLevel, logContext);
          } else {
            // if it's not nested then we check if the value is a reference
            if (refMap.has(value)) {
              const pulledRef = refMap.get(value) as ApexVariableContainer;
              const tmpContainer = this.copyReferenceContainer(
                pulledRef,
                varName,
                logContext
              );
              refContainer.variables.set(varName, tmpContainer);
              // if not a reference, update the variable value, creating a container if needed
            } else if (refContainer.variables.has(varName)) {
              const varContainer = refContainer.variables.get(
                varName
              ) as ApexVariableContainer;
              varContainer.value = value;
            } else {
              refContainer.variables.set(
                varName,
                new ApexVariableContainer(varName, value, '')
              );
            }
          }
          // if not nested then the refcontainer is the top level
        } else if (value.indexOf('{') === 0) {
          this.parseJSONAndPopulate(value, refContainer, logContext);
        } else {
          refContainer.variables.set(
            varName,
            new ApexVariableContainer(varName, value, '')
          );
        }

        // update toplevel container if it's not this and not a collection
        // or if the this variable has not been assigned a reference yet
        if (
          (container &&
            this.isNotCollection(container) &&
            container.name !== 'this') ||
          (container && container.name === 'this' && !container.ref)
        ) {
          container.ref = ref;
          container.value = '';
          container.variables = refContainer.variables;
          refContainer.type = container.type;
          if (value === '{}') {
            container.value = value;
          }
          if (container.variablesRef === 0) {
            container.value = '';
            container.variablesRef = logContext
              .getVariableHandler()
              .create(container);
          }
        } else if (container && container.name !== 'this') {
          container.value = value;
        }
      } else {
        if (container) {
          container.value = value;
        }
      }
    }
    return false;
  }

  private isNotCollection(container: ApexVariableContainer): boolean {
    return (
      !container.type.startsWith('Map<') &&
      !container.type.startsWith('List<') &&
      !container.type.startsWith('Set<')
    );
  }

  private parseJSONAndPopulate(
    value: string,
    container: ApexVariableContainer,
    logContext: LogContext
  ) {
    try {
      const obj = JSON.parse(value);
      Object.keys(obj).forEach(key => {
        const refContainer = logContext.getRefsMap().get(String(obj[key]))!;
        if (refContainer) {
          const tmpContainer = this.copyReferenceContainer(
            refContainer,
            key,
            logContext
          );
          container.variables.set(key, tmpContainer);
        } else {
          let varValue = obj[key];
          if (typeof varValue === 'string') {
            varValue = "'" + varValue + "'";
          }
          container.variables.set(
            key,
            new ApexVariableContainer(key, varValue, '')
          );
        }
      });
    } catch (e) {
      container.value = value;
      container.variablesRef = 0;
      container.variables.clear();
    }
  }
  private copyReferenceContainer(
    refContainer: ApexVariableContainer,
    varName: string,
    logContext: LogContext
  ) {
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
    return tmpContainer;
  }
}
