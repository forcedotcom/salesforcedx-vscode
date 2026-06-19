/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ApexVariableContainer } from '../adapter/variableContainer';
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
      const className = name.includes('.') ? name.substring(0, name.lastIndexOf('.')) : '';
      const varName = nameSplit.length > 0 ? nameSplit.at(-1)! : name;
      const value = this.fields[4].replace(/^"/, "'").replace(/"$/, "'");
      let ref;
      if (this.fields.length === 6) {
        ref = this.fields[5];
      }

      const refMap = logContext.getRefsMap();
      let container: ApexVariableContainer | undefined;
      let map: Map<string, ApexVariableContainer> | undefined;
      let isNested = false;

      // Grab the a top level container from statics or locals if it exists
      if (logContext.getStaticVariablesClassMap().has(className)) {
        map = logContext.getStaticVariablesClassMap().get(className)!;
        container = map.get(varName)!;
        // If the className is 'this' that means the variable being split was
        // this.<something>. We need to check the className for 'this' otherwise
        // a propery on 'this' would get incorrectly processed as a local variable.
      } else if (className !== 'this' && frameInfo?.locals.has(varName)) {
        map = frameInfo.locals;
        container = map.get(varName);
        // if the variable we're given is a child variable, then it will come in the format of this.varName
      } else if (name.includes('.')) {
        isNested = true;
      }

      // update the ref mapping
      if (ref) {
        if (!refMap.has(ref)) {
          logContext.getRefsMap().set(ref, new ApexVariableContainer('', '', '', ref));
        }
        const refContainer = refMap.get(ref)!;
        // nested variable will either be given a json or a value
        if (isNested) {
          if (value === '{}') {
            refContainer.variables.set(varName, new ApexVariableContainer(varName, value, ''));
            // if its a json assignment, parse the values
          } else if (value.startsWith('{')) {
            const topLevel = new ApexVariableContainer(varName, '', '');
            refContainer.variables.set(varName, topLevel);
            topLevel.variablesRef = logContext.getVariableHandler().create(topLevel);
            this.parseJSONAndPopulate(value, topLevel, logContext);
          } else {
            // if it's not nested then we check if the value is a reference
            if (refMap.has(value)) {
              const pulledRef = refMap.get(value)!;
              const tmpContainer = this.copyReferenceContainer(pulledRef, varName, logContext);
              refContainer.variables.set(varName, tmpContainer);
              // if not a reference, update the variable value, creating a container if needed
            } else if (refContainer.variables.has(varName)) {
              const varContainer = refContainer.variables.get(varName)!;
              varContainer.value = value;
            } else {
              refContainer.variables.set(varName, new ApexVariableContainer(varName, value, ''));
            }
          }
          // if not nested then the refcontainer is the top level
        } else if (value.startsWith('{')) {
          this.parseJSONAndPopulate(value, refContainer, logContext);
        } else {
          refContainer.variables.set(varName, new ApexVariableContainer(varName, value, ''));
        }

        // update toplevel container if it's not this and not a collection
        // or if the this variable has not been assigned a reference yet
        if (
          (container && this.isNotCollection(container) && container.name !== 'this') ||
          (container?.name === 'this' && !container?.ref)
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
            container.variablesRef = logContext.getVariableHandler().create(container);
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
      !container.type.startsWith('Map<') && !container.type.startsWith('List<') && !container.type.startsWith('Set<')
    );
  }

  private parseJSONAndPopulate(value: string, container: ApexVariableContainer, logContext: LogContext) {
    try {
      const modifiedValue = logContext.getUtil().surroundBlobsWithQuotes(value);
      const obj = JSON.parse(modifiedValue);
      // Recurse on the already-parsed object so inner string values aren't re-quoted/re-stringified.
      this.populateFromParsed(obj, container, logContext);
    } catch {
      container.value = value;
      container.variablesRef = 0;
      container.variables.clear();
    }
  }

  // Populate a container's children from an already-parsed JSON value (object or array).
  // Operates on the parsed value directly to avoid re-running surroundBlobsWithQuotes /
  // JSON.stringify on inner values (which would mangle already-quoted strings).
  private populateFromParsed(parsed: any, container: ApexVariableContainer, logContext: LogContext) {
    const keys: string[] = Array.isArray(parsed) ? parsed.map((_, index) => index.toString()) : Object.keys(parsed);
    keys.forEach(key => {
      const rawValue = parsed[key];
      const refContainer = logContext.getRefsMap().get(String(rawValue))!;
      if (refContainer) {
        const tmpContainer = this.copyReferenceContainer(refContainer, key, logContext);
        container.variables.set(key, tmpContainer);
      } else if (rawValue !== null && typeof rawValue === 'object') {
        // Nested object/array (parent SObject rel, multi-level hierarchy, or child subquery
        // records). Build an expandable child container and recurse. type='' is acceptable:
        // VARIABLE_ASSIGNMENT JSON carries no nested SObject type metadata (only field
        // name/value), unlike the heap-dump path which reads types from a separate source.
        const nested = new ApexVariableContainer(key, '', '');
        container.variables.set(key, nested);
        nested.variablesRef = logContext.getVariableHandler().create(nested);
        this.populateFromParsed(rawValue, nested, logContext);
      } else {
        const varValue =
          typeof rawValue === 'string' ? logContext.getUtil().removeQuotesFromBlob(`'${rawValue}'`) : `${rawValue}`;
        container.variables.set(key, new ApexVariableContainer(key, varValue, ''));
      }
    });
  }
  private copyReferenceContainer(refContainer: ApexVariableContainer, varName: string, logContext: LogContext) {
    const tmpContainer = new ApexVariableContainer(varName, refContainer.value, refContainer.type, refContainer.ref);
    tmpContainer.variables = refContainer.variables;
    tmpContainer.variablesRef = logContext.getVariableHandler().create(tmpContainer);
    return tmpContainer;
  }
}
