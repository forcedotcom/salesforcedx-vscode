/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { StackFrame } from 'vscode-debugadapter';
import { ApexVariableContainer } from '../adapter/apexReplayDebug';
import {
  HeadpDumpExtentValue,
  HeadpDumpExtentValueEntry
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
      const frameInfo = this.logContext.getFrameHandler().get(frame.id);
      const refVariableToRevisit = new Map<string, ApexVariableContainer>();
      const valueVariableToRevisit = new Map<string, HeadpDumpExtentValue>();
      for (const outerExtent of heapdump.getOverlaySuccessResult()!.HeapDump
        .extents) {
        if (frame.name.includes(outerExtent.typeName)) {
          for (const innerExtent of outerExtent.extent) {
            if (!innerExtent.address || !innerExtent.value.entry) {
              continue;
            }
            const refContainer = this.logContext
              .getRefsMap()
              .get(innerExtent.address);
            if (!refContainer) {
              continue;
            }
            for (const variableEntry of innerExtent.value.entry) {
              refContainer.variables.forEach((value, key) => {
                if (
                  variableEntry.keyDisplayValue ===
                  (value as ApexVariableContainer).name
                ) {
                  if (this.isAddress(variableEntry.value.value)) {
                    if (valueVariableToRevisit.has(variableEntry.value.value)) {
                      const extentValue = valueVariableToRevisit.get(
                        variableEntry.value.value
                      );
                      if (extentValue) {
                        this.updateVariableContainerWithExtentValueOrEntry(
                          value as ApexVariableContainer,
                          extentValue.value,
                          extentValue.entry
                        );
                      }
                    } else {
                      refVariableToRevisit.set(
                        variableEntry.value.value,
                        value as ApexVariableContainer
                      );
                    }
                  } else {
                    this.updateVariableContainerWithExtentValueOrEntry(
                      value as ApexVariableContainer,
                      variableEntry.value.value,
                      undefined
                    );
                  }
                }
              });
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
              this.updateVariableContainer(localVar, innerExtent.value);
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
                this.updateVariableContainer(
                  statics.get(staticVarName) as ApexVariableContainer,
                  innerExtent.value
                );
              }
            } else if (innerExtent.address) {
              if (refVariableToRevisit.has(innerExtent.address)) {
                this.updateVariableContainer(
                  refVariableToRevisit.get(innerExtent.address)!,
                  innerExtent.value,
                  outerExtent.typeName
                );
              } else {
                valueVariableToRevisit.set(
                  innerExtent.address,
                  innerExtent.value
                );
              }
            }
          }
        }
      }
    }
  }

  public updateVariableContainer(
    varContainer: ApexVariableContainer,
    heapDumpExtentValue: HeadpDumpExtentValue,
    type?: string
  ): void {
    if (heapDumpExtentValue.value) {
      this.updateVariableContainerWithExtentValue(
        varContainer,
        heapDumpExtentValue.value,
        type
      );
    } else if (heapDumpExtentValue.entry) {
      varContainer.variables.forEach((value, key) => {
        for (const variableEntry of heapDumpExtentValue.entry!) {
          const valueAsApexVar = value as ApexVariableContainer;
          this.updateVariableContainerWithExtentValueOrEntry(
            valueAsApexVar,
            variableEntry.value.value,
            variableEntry.value.entry
          );
        }
      });
    }
  }

  public updateVariableContainerWithExtentValueOrEntry(
    varContainer: ApexVariableContainer,
    extentValue: any,
    extentEntry: HeadpDumpExtentValueEntry[] | undefined
  ): void {
    if (extentValue) {
      this.updateVariableContainerWithExtentValue(varContainer, extentValue);
    } else if (extentEntry) {
      for (const extentValueEntry of extentEntry) {
        if (extentValueEntry.keyDisplayValue === varContainer.name) {
          return this.updateVariableContainerWithExtentValueOrEntry(
            varContainer,
            extentValueEntry.value.value,
            extentValueEntry.value.entry
          );
        }
        varContainer.variables.forEach((value, key) => {
          this.updateVariableContainerWithExtentValueOrEntry(
            value as ApexVariableContainer,
            extentValue,
            extentEntry
          );
        });
      }
    }
  }

  public updateVariableContainerWithExtentValue(
    varContainer: ApexVariableContainer,
    extentValue: any,
    type?: string
  ): void {
    if (type && varContainer.type.length === 0) {
      varContainer.type = type;
    }
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

  public isAddress(value: any): boolean {
    return (
      typeof value === 'string' && (value as string).startsWith(ADDRESS_PREFIX)
    );
  }
}
