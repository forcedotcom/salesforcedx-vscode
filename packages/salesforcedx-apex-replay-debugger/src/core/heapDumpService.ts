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
                        this.updateVariableContainerWithExtentValue(
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
                    this.updateVariableContainerWithExtentValue(
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
            if (symbolName && frameInfo.locals.has(symbolName)) {
              const localVar = frameInfo.locals.get(
                symbolName
              ) as ApexVariableContainer;
              this.updateVariableContainer(localVar, innerExtent.value);
            } else if (innerExtent.address) {
              if (refVariableToRevisit.has(innerExtent.address)) {
                this.updateVariableContainer(
                  refVariableToRevisit.get(innerExtent.address)!,
                  innerExtent.value
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
    heapDumpExtentValue: HeadpDumpExtentValue
  ): void {
    if (heapDumpExtentValue.value) {
      if (typeof heapDumpExtentValue.value === 'string') {
        varContainer.value = `'${heapDumpExtentValue.value}'`;
      } else if (Array.isArray(heapDumpExtentValue.value)) {
        const values = heapDumpExtentValue.value as any[];
        for (let i = 0; i < values.length; i++) {
          varContainer.variables.set(
            i.toString(),
            new ApexVariableContainer(i.toString(), `'${values[i].value}'`, '')
          );
        }
      } else {
        varContainer.value = `${heapDumpExtentValue.value}`;
      }
    } else if (heapDumpExtentValue.entry) {
      varContainer.variables.forEach((value, key) => {
        for (const variableEntry of heapDumpExtentValue.entry!) {
          this.updateVariableContainerWithExtentValue(
            value as ApexVariableContainer,
            variableEntry.value.value,
            variableEntry.value.entry
          );
        }
      });
    }
  }

  public updateVariableContainerWithExtentValue(
    varContainer: ApexVariableContainer,
    extentValue: any,
    extentEntry: HeadpDumpExtentValueEntry[] | undefined
  ): void {
    if (extentValue) {
      varContainer.value = `${extentValue}`;
    } else if (extentEntry) {
      for (const extentValueEntry of extentEntry) {
        if (extentValueEntry.keyDisplayValue === varContainer.name) {
          return this.updateVariableContainerWithExtentValue(
            varContainer,
            extentValueEntry.value.value,
            extentValueEntry.value.entry
          );
        }
        varContainer.variables.forEach((value, key) => {
          this.updateVariableContainerWithExtentValue(
            value as ApexVariableContainer,
            extentValue,
            extentEntry
          );
        });
      }
    }
  }

  public isAddress(value: any) {
    return (
      typeof value === 'string' && (value as string).startsWith(ADDRESS_PREFIX)
    );
  }
}
