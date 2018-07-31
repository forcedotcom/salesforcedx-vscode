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
  HeapDumpExtentValue,
  HeapDumpExtentValueEntry
} from '../commands/apexExecutionOverlayResultCommand';
import { ADDRESS_PREFIX } from '../constants';
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
    if (heapDumpExtentValue.value) {
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
    if (extentValue) {
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
        varContainer.variables.forEach((value, key) => {
          this.updateContainerWithExtentValueOrEntry(
            value as ApexVariableContainer,
            extentValue,
            extentEntry
          );
        });
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
}
