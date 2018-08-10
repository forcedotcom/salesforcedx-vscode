/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { StackFrame } from 'vscode-debugadapter';
import { ApexVariableContainer } from '../adapter/apexReplayDebug';
import {
  ApexExecutionOverlayResultCommandSuccess,
  HeapDumpCollectionTypeDefinition,
  HeapDumpExtents,
  HeapDumpExtentValue,
  HeapDumpExtentValueEntry
} from '../commands/apexExecutionOverlayResultCommand';
import { ADDRESS_PREFIX, EXTENT_TRIGGER_PREFIX } from '../constants';
import { LogContext } from './logContext';

export class HeapDumpService {
  private logContext: LogContext;

  public constructor(logContext: LogContext) {
    this.logContext = logContext;
  }

  public replaceVariablesWithHeapDump(): void {
    const topFrame = this.logContext.getTopFrame();
    if (topFrame) {
      this.replaceFrameVariablesWithHeapDump(topFrame);
    }
  }

  public replaceFrameVariablesWithHeapDump(frame: StackFrame): void {
    const heapdump = this.logContext.getHeapDumpForThisLocation(
      frame.name,
      frame.line
    );
    if (heapdump && heapdump.getOverlaySuccessResult()) {
      const heapdumpResult = heapdump.getOverlaySuccessResult()!;
      const frameInfo = this.logContext.getFrameHandler().get(frame.id);
      const referenceToRevisit = new Map<string, ApexVariableContainer>();
      const extentToRevisit = new Map<string, HeapDumpExtentValue>();
      let variableTypes = this.getStringVariableNamesAndValues(heapdumpResult);

      for (const outerExtent of heapdumpResult.HeapDump.extents) {
        variableTypes = this.addVariableTypesFromExtentDefinition(
          variableTypes,
          outerExtent.definition
        );
        if (frame.name.includes(outerExtent.typeName)) {
          for (const innerExtent of outerExtent.extent) {
            if (!innerExtent.address || !innerExtent.value.entry) {
              continue;
            }

            const refContainer = this.logContext
              .getRefsMap()
              .get(innerExtent.address);
            if (refContainer) {
              this.updateContainerChildrenWithEntries(
                refContainer,
                innerExtent.value.entry,
                extentToRevisit,
                referenceToRevisit,
                variableTypes
              );
            }
          }
        } else {
          for (const innerExtent of outerExtent.extent) {
            const symbolName =
              innerExtent.symbols && innerExtent.symbols.length > 0
                ? innerExtent.symbols[0]
                : undefined;
            const className = symbolName
              ? this.logContext.getUtil().substringUpToLastPeriod(symbolName)
              : undefined;
            if (symbolName && frameInfo.locals.has(symbolName)) {
              const localVar = frameInfo.locals.get(
                symbolName
              ) as ApexVariableContainer;
              this.updateContainer(
                localVar,
                innerExtent.value,
                extentToRevisit,
                referenceToRevisit,
                variableTypes
              );
            } else if (
              symbolName &&
              className &&
              this.logContext.getStaticVariablesClassMap().has(className)
            ) {
              const statics = this.logContext
                .getStaticVariablesClassMap()
                .get(className);
              const staticVarName = this.logContext
                .getUtil()
                .substringFromLastPeriod(symbolName);
              if (statics && statics.has(staticVarName)) {
                this.updateContainer(
                  statics.get(staticVarName) as ApexVariableContainer,
                  innerExtent.value,
                  extentToRevisit,
                  referenceToRevisit,
                  variableTypes
                );
              }
            }
            if (innerExtent.address) {
              if (referenceToRevisit.has(innerExtent.address)) {
                this.updateContainer(
                  referenceToRevisit.get(innerExtent.address)!,
                  innerExtent.value,
                  extentToRevisit,
                  referenceToRevisit,
                  variableTypes
                );
              } else {
                extentToRevisit.set(innerExtent.address, innerExtent.value);
                variableTypes.set(innerExtent.address, outerExtent.typeName);
              }
            }
          }
        }
      }
      // Create the trigger context variables in the global context. Unlike locals or statics
      // the global variable container should be empty and these variables are created from
      // scratch instead of updating existing variables.
      if (this.logContext.isRunningApexTrigger()) {
        for (const outerExtent of heapdumpResult.HeapDump.extents) {
          if (this.isTriggerExtent(outerExtent)) {
            // The trigger context variables are going to be immediate children of the outerExtent.
            for (const innerExtent of outerExtent.extent) {
              // All of the symbols are going to start with the trigger prefix and will be exclusive
              // to trigger context varables. It's worth noting that any local variables or statics
              // within the triggger will be under "this" and won't get picked up there.
              if (innerExtent.symbols && innerExtent.symbols.length > 0) {
                for (const symName of innerExtent.symbols) {
                  if (symName && symName.startsWith(EXTENT_TRIGGER_PREFIX)) {
                    // Update the type mapping if necessary
                    if (!variableTypes.has(symName)) {
                      variableTypes.set(symName, outerExtent.typeName);
                    }
                    // Create the variable container
                    frameInfo.globals.set(
                      symName,
                      new ApexVariableContainer(
                        symName,
                        '',
                        outerExtent.typeName
                      )
                    );
                    const globalVar = frameInfo.globals.get(
                      symName
                    ) as ApexVariableContainer;
                    // Setting the variableref needs to get done in order for VS Code to be able to
                    // expand list/map variables. The reason this isn't done for booleans is that it
                    // would end up creating a collapsible variable with no value, just the arrow to
                    // expand or collapse which is incorrect.
                    if (outerExtent.typeName !== 'Boolean') {
                      globalVar.variablesRef = this.logContext
                        .getVariableHandler()
                        .create(globalVar);
                    }
                    this.updateContainer(
                      globalVar,
                      innerExtent.value,
                      extentToRevisit,
                      referenceToRevisit,
                      variableTypes
                    );
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  public updateContainerOrCache(
    variableContainer: ApexVariableContainer,
    variableEntry: HeapDumpExtentValueEntry,
    extentToRevisit: Map<string, HeapDumpExtentValue>,
    referenceToRevisit: Map<string, ApexVariableContainer>,
    variableTypes: Map<string, string>
  ): void {
    if (this.isAddress(variableEntry.value.value)) {
      if (extentToRevisit.has(variableEntry.value.value)) {
        const extentValue = extentToRevisit.get(variableEntry.value.value);
        if (extentValue) {
          this.updateContainerType(
            variableContainer,
            variableTypes.get(variableEntry.value.value)
          );
          this.updateContainer(
            variableContainer,
            extentValue,
            extentToRevisit,
            referenceToRevisit,
            variableTypes
          );
        }
      } else {
        referenceToRevisit.set(variableEntry.value.value, variableContainer);
      }
    } else {
      this.updateContainerWithExtentValueOrEntry(
        variableContainer,
        variableEntry.value.value,
        undefined,
        variableTypes.get(variableEntry.keyDisplayValue)
      );
    }
  }

  public updateContainer(
    varContainer: ApexVariableContainer,
    heapDumpExtentValue: HeapDumpExtentValue,
    extentToRevisit: Map<string, HeapDumpExtentValue>,
    referenceToRevisit: Map<string, ApexVariableContainer>,
    variableTypes: Map<string, string>
  ): void {
    if (typeof heapDumpExtentValue.value !== 'undefined') {
      this.updateContainerWithExtentValue(
        varContainer,
        heapDumpExtentValue.value,
        variableTypes.get(varContainer.name)
      );
    } else if (heapDumpExtentValue.entry) {
      this.updateContainerChildrenWithEntries(
        varContainer,
        heapDumpExtentValue.entry,
        extentToRevisit,
        referenceToRevisit,
        variableTypes
      );
    }
  }

  public updateContainerChildrenWithEntries(
    varContainer: ApexVariableContainer,
    extentValueEntries: HeapDumpExtentValueEntry[],
    extentToRevisit: Map<string, HeapDumpExtentValue>,
    referenceToRevisit: Map<string, ApexVariableContainer>,
    variableTypes: Map<string, string>
  ): void {
    for (const extentValueEntry of extentValueEntries) {
      let foundMatchingApexVariable = false;
      for (const entry of Array.from(varContainer.variables.entries())) {
        const valueAsApexVar = entry[1] as ApexVariableContainer;
        if (this.isContainerForExtentEntry(valueAsApexVar, extentValueEntry)) {
          this.updateContainerOrCache(
            valueAsApexVar,
            extentValueEntry,
            extentToRevisit,
            referenceToRevisit,
            variableTypes
          );
          foundMatchingApexVariable = true;
          break;
        }
      }
      if (!foundMatchingApexVariable) {
        const variableType =
          variableTypes.get(extentValueEntry.keyDisplayValue) || '';
        varContainer.variables.set(
          extentValueEntry.keyDisplayValue,
          new ApexVariableContainer(
            extentValueEntry.keyDisplayValue,
            extentValueEntry.value.value,
            variableType
          )
        );
      }
    }
  }

  public updateContainerWithExtentValueOrEntry(
    varContainer: ApexVariableContainer,
    extentValue: any,
    extentEntry: HeapDumpExtentValueEntry[] | undefined,
    type?: string
  ): void {
    if (typeof extentValue !== 'undefined') {
      this.updateContainerWithExtentValue(varContainer, extentValue, type);
    } else if (extentEntry) {
      for (const extentValueEntry of extentEntry) {
        if (this.isContainerForExtentEntry(varContainer, extentValueEntry)) {
          return this.updateContainerWithExtentValueOrEntry(
            varContainer,
            extentValueEntry.value.value,
            extentValueEntry.value.entry
          );
        }
        if (varContainer.variables.has(extentValueEntry.keyDisplayValue)) {
          const value = varContainer.variables.get(
            extentValueEntry.keyDisplayValue
          ) as ApexVariableContainer;
          this.updateContainerWithExtentValueOrEntry(
            value as ApexVariableContainer,
            extentValue,
            extentEntry
          );
        }
      }
    }
  }

  public updateContainerWithExtentValue(
    varContainer: ApexVariableContainer,
    extentValue: any,
    type?: string
  ): void {
    this.updateContainerType(varContainer, type);
    if (typeof extentValue === 'string' && varContainer.type === 'String') {
      varContainer.value = `'${extentValue}'`;
    } else if (Array.isArray(extentValue)) {
      const values = extentValue as any[];
      for (let i = 0; i < values.length; i++) {
        varContainer.variables.set(
          i.toString(),
          new ApexVariableContainer(i.toString(), `'${values[i].value}'`, '')
        );
      }
    } else {
      varContainer.value = `${extentValue}`;
    }
  }

  public updateContainerType(
    varContainer: ApexVariableContainer,
    type?: string
  ) {
    if (type && varContainer.type.length === 0) {
      varContainer.type = type;
    }
  }

  public getStringVariableNamesAndValues(
    heapdump: ApexExecutionOverlayResultCommandSuccess
  ): Map<string, string> {
    const variableTypes = new Map<string, string>();
    for (const outerExtent of heapdump.HeapDump.extents) {
      if (outerExtent.typeName !== 'String') {
        continue;
      }
      for (const innerExtent of outerExtent.extent) {
        variableTypes.set(innerExtent.value.value, 'String');
      }
    }
    return variableTypes;
  }

  public addVariableTypesFromExtentDefinition(
    variableTypes: Map<string, string>,
    definitions: HeapDumpCollectionTypeDefinition[]
  ): Map<string, string> {
    return new Map([
      ...variableTypes,
      ...definitions.map((obj): [string, string] => [obj.name, obj.type])
    ]);
  }

  public isAddress(value: any): boolean {
    return (
      typeof value === 'string' && (value as string).startsWith(ADDRESS_PREFIX)
    );
  }

  public isContainerForExtentEntry(
    varContainer: ApexVariableContainer,
    extentValueEntry: HeapDumpExtentValueEntry
  ) {
    return varContainer.name === extentValueEntry.keyDisplayValue;
  }

  public isTriggerExtent(outerExtent: HeapDumpExtents) {
    if (
      (outerExtent.typeName === 'Boolean' ||
        outerExtent.typeName.startsWith('List<') ||
        outerExtent.typeName.startsWith('Map<')) &&
      (outerExtent.count > 0 &&
        outerExtent.extent[0].symbols !== null &&
        outerExtent.extent[0].symbols!.length > 0 &&
        outerExtent.extent[0].symbols![0].startsWith(EXTENT_TRIGGER_PREFIX))
    ) {
      return true;
    }
    return false;
  }
}
