/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { StackFrame } from '@vscode/debugadapter';
import { ApexVariableContainer } from '../adapter/variableContainer';
import {
  ApexExecutionOverlayResultCommandSuccess,
  HeapDumpExtents,
  HeapDumpExtentValue
} from '../commands/apexExecutionOverlayResultCommand';
import {
  ADDRESS_PREFIX,
  APEX_PRIMITIVE_STRING,
  EXTENT_TRIGGER_PREFIX,
  KEY_VALUE_PAIR,
  KEY_VALUE_PAIR_KEY,
  KEY_VALUE_PAIR_VALUE,
  LC_APEX_PRIMITIVE_BLOB,
  LC_APEX_PRIMITIVE_BOOLEAN,
  LC_APEX_PRIMITIVE_DATE,
  LC_APEX_PRIMITIVE_DATETIME,
  LC_APEX_PRIMITIVE_DECIMAL,
  LC_APEX_PRIMITIVE_DOUBLE,
  LC_APEX_PRIMITIVE_ID,
  LC_APEX_PRIMITIVE_INTEGER,
  LC_APEX_PRIMITIVE_LONG,
  LC_APEX_PRIMITIVE_STRING,
  LC_APEX_PRIMITIVE_TIME
} from '../constants';
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
    const heapdumpResult = this.logContext
      .getHeapDumpForThisLocation(frame.name, frame.line)
      ?.getOverlaySuccessResult();
    if (heapdumpResult) {
      const frameInfo = this.logContext.getFrameHandler().get(frame.id);

      // There should be an order here for processing the heap dumps
      // 1. Process any Strings
      // 2. Process any leaf references - leaf references are everything that's not a primitive type
      //    Once the leaf references are set then anything else, even items with nested references,
      //    should be able to be pieced together.
      // 3. Process any variables for local, static and global scopes. With all of the leaf references
      //    from the extent in the ref list more complex items (ie collections of references) can be
      //    pieced together. For existing variables and variableRefs, clean out everything and rebuild
      //    the variables from scratch. The reason for this is that existing variables may or may not
      //    have their type information set correctly (ie. collections). Further, any variable handler
      //    references should really be recreated.

      // Clear out the ref's map
      this.logContext.getRefsMap().clear();
      // Clear out the variableHandler
      this.logContext.getVariableHandler().reset();
      // Add the strings to the ref map. Strings are going to be in their own extent entry.
      // With the strings in the ref map, when creating the leaf references, their values can be
      // pulled during leaf creation.
      this.createStringRefsFromHeapdump(heapdumpResult);

      // Create the high level references
      for (const outerExtent of heapdumpResult.HeapDump.extents) {
        // Ignore primitiveTypes (includes strings)
        if (!this.isPrimitiveType(outerExtent.typeName)) {
          for (const innerExtent of outerExtent.extent) {
            const ref = innerExtent.address;
            const refContainer = new ApexVariableContainer('', '', outerExtent.typeName, ref);
            this.updateLeafReferenceContainer(refContainer, innerExtent, outerExtent.collectionType);
            // add the leaf to the ref's map
            this.logContext.getRefsMap().set(ref, refContainer);
          }
        }
      }

      // At this point all the leaf references are collected and any variable should
      // be able to be built from the leaves.
      for (const outerExtent of heapdumpResult.HeapDump.extents) {
        for (const innerExtent of outerExtent.extent) {
          const symbolName = innerExtent.symbols && innerExtent.symbols.length > 0 ? innerExtent.symbols[0] : undefined;
          const className = symbolName ? this.logContext.getUtil().substringUpToLastPeriod(symbolName) : undefined;
          if (symbolName && frameInfo?.locals.has(symbolName)) {
            const localVar = frameInfo.locals.get(symbolName)!;

            // Ensure the typename is set correctly.
            localVar.type = outerExtent.typeName;

            // If the variable is a reference then create a new, updated variable
            // from the reference and toss away the old one. The reason for this
            // is that we really don't know the state/status of any of the variable's
            // children and the same applies to the variablesRef which is necessary
            // to expand the variable in variables window.
            const refVar = this.logContext.getRefsMap().get(innerExtent.address);
            if (refVar) {
              if (refVar.type === LC_APEX_PRIMITIVE_STRING) {
                localVar.value = refVar.value;
              } else {
                const updatedVariable = this.createVariableFromReference(
                  symbolName,
                  refVar,
                  new Map<string, null>(),
                  new Array<ApexVariableContainer>()
                );
                if (updatedVariable) {
                  frameInfo.locals.set(localVar.name, updatedVariable);
                }
              }
              // If the variable isn't a reference then it's just a single value
            } else {
              localVar.value = this.createStringFromExtentValue(innerExtent.value.value);
            }
          } else if (symbolName && className && this.logContext.getStaticVariablesClassMap().has(className)) {
            const statics = this.logContext.getStaticVariablesClassMap().get(className);
            const staticVarName = this.logContext.getUtil().substringFromLastPeriod(symbolName);
            if (statics?.has(staticVarName)) {
              const staticVar = statics.get(staticVarName)!;
              staticVar.type = outerExtent.typeName;

              const refVar = this.logContext.getRefsMap().get(innerExtent.address);
              if (refVar) {
                if (refVar.type === LC_APEX_PRIMITIVE_STRING) {
                  staticVar.value = refVar.value;
                } else {
                  const updatedVariable = this.createVariableFromReference(
                    symbolName,
                    refVar,
                    new Map<string, null>(),
                    new Array<ApexVariableContainer>()
                  );
                  if (updatedVariable) {
                    statics.set(staticVar.name, updatedVariable);
                  }
                }
                // If the variable isn't a reference then it's just a single value
              } else {
                staticVar.value = this.createStringFromExtentValue(innerExtent.value.value);
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
                  if (symName?.startsWith(EXTENT_TRIGGER_PREFIX)) {
                    const refVar = this.logContext.getRefsMap().get(innerExtent.address);
                    if (refVar) {
                      const updatedVariable = this.createVariableFromReference(
                        symName,
                        refVar,
                        new Map<string, null>(),
                        new Array<ApexVariableContainer>()
                      );
                      if (updatedVariable) {
                        frameInfo?.globals.set(symName, updatedVariable);
                      }
                      // If the variable isn't a reference then it's just a single value, create
                      // the variable and add it to the globals list
                    } else {
                      frameInfo?.globals.set(
                        symName,
                        new ApexVariableContainer(
                          symName,
                          this.createStringFromExtentValue(innerExtent.value.value),
                          outerExtent.typeName
                        )
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
  }

  // If the extent has strings in it there will be an entry of "typeName": "String".
  // Add those those to reference list before processing any other references. The
  // reason for this is that it allows strings to be treated as values instead of
  // child references
  public createStringRefsFromHeapdump(heapdump: ApexExecutionOverlayResultCommandSuccess): void {
    const refsMap = this.logContext.getRefsMap();
    for (const outerExtent of heapdump.HeapDump.extents) {
      if (outerExtent.typeName.toLowerCase() !== LC_APEX_PRIMITIVE_STRING) {
        continue;
      }
      for (const innerExtent of outerExtent.extent) {
        // If there's already a value for the string's address then update it with the extent's
        // entry data
        if (!refsMap.has(innerExtent.address)) {
          refsMap.set(
            innerExtent.address,
            new ApexVariableContainer('', innerExtent.value.value, APEX_PRIMITIVE_STRING, innerExtent.address)
          );
        }
        const refVar = refsMap.get(innerExtent.address)!; // either existed or we just set it
        refVar.type = APEX_PRIMITIVE_STRING;
        refVar.value = `'${innerExtent.value.value}'`;
      }
    }
  }

  public isAddress(value: any): boolean {
    return typeof value === 'string' && value.startsWith(ADDRESS_PREFIX);
  }

  public isTriggerExtent(outerExtent: HeapDumpExtents) {
    if (
      (outerExtent.typeName.toLowerCase() === LC_APEX_PRIMITIVE_BOOLEAN ||
        this.isCollectionType(outerExtent.typeName)) &&
      outerExtent.count > 0 &&
      outerExtent.extent[0].symbols !== null &&
      outerExtent.extent[0].symbols.length > 0 &&
      outerExtent.extent[0].symbols[0].startsWith(EXTENT_TRIGGER_PREFIX)
    ) {
      return true;
    }
    return false;
  }

  // This is where a reference turns into a variable. The refContainer is
  // cloned into a new variable that has a variable name.
  private copyReferenceContainer(refContainer: ApexVariableContainer, varName: string, createVarRef = true) {
    const tmpContainer = new ApexVariableContainer(varName, refContainer.value, refContainer.type, refContainer.ref);
    tmpContainer.variables = refContainer.variables;
    // If this isn't a primitive type then it needs to have its variableRef
    // set so it can be expanded in the variables window. Note this check
    // is kind of superfluous but it's better to be safe than sorry
    if (!this.isPrimitiveType(tmpContainer.type)) {
      if (createVarRef) {
        tmpContainer.variablesRef = this.logContext.getVariableHandler().create(tmpContainer);
      } else {
        // If the variable is being cloned for a name change then
        // it needs to use the same variablesRef as the parent
        tmpContainer.variablesRef = refContainer.variablesRef;
      }
    }
    return tmpContainer;
  }

  // The way the variables are displayed in the variable's window is <varName>:<value>
  // and the value is basically a 'toString' of the variable. This is easy enough for
  // primitive types but for things like collections it ends up being something like
  // MyStrList: ('1','2','3') which when expanded looks like
  // MyStrList: ('1','2','3')
  //   0: '1'
  //   1: '2'
  //   2: '3'
  private createStringFromVarContainer(varContainer: ApexVariableContainer, visitedSet: Set<string>): string {
    // If the varContainer isn't a reference or is a string references
    if (!varContainer.ref || varContainer.type.toLowerCase() === LC_APEX_PRIMITIVE_STRING) {
      return varContainer.value;
    }

    // If the varContainer is a ref and it's already been visited then return the string
    if (varContainer.ref) {
      if (visitedSet.has(varContainer.ref)) {
        return 'already output';
      } else {
        visitedSet.add(varContainer.ref);
      }
    }
    let returnString = '';
    try {
      // For a list or set the name string is going to end up being (<val1>,...<valX)
      // For a objects, the name string is going to end up being <TypeName>: {<Name1>=<Value1>,...<NameX>=<ValueX>}
      const isListOrSet =
        varContainer.type.toLowerCase().startsWith('list<') || varContainer.type.toLowerCase().startsWith('set<');
      // The live debugger, for collections, doesn't include their type in variable name/value
      const containerType = this.isCollectionType(varContainer.type) ? '' : `${varContainer.type}:`;
      returnString = isListOrSet ? '(' : `${containerType}{`;
      let first = true;
      // Loop through each of the container's variables to get the name/value combinations, calling to create
      // the string if another collection is found.
      for (const entry of Array.from(varContainer.variables.entries())) {
        const valueAsApexVar = entry[1];
        if (!first) {
          returnString += ', ';
        }
        if (valueAsApexVar.ref) {
          // if this is also a ref then create the string from that
          returnString += this.createStringFromVarContainer(valueAsApexVar, visitedSet);
        } else {
          // otherwise get the name/value from the variable
          returnString += isListOrSet ? valueAsApexVar.value : `${valueAsApexVar.name}=${valueAsApexVar.value}`;
        }
        first = false;
      }
      returnString += isListOrSet ? ')' : '}';
    } finally {
      if (varContainer.ref) {
        visitedSet.delete(varContainer.ref);
      }
    }
    return returnString;
  }

  private isPrimitiveType(typeName: string): boolean {
    const lcTypeName = typeName.toLocaleLowerCase();
    if (
      lcTypeName === LC_APEX_PRIMITIVE_BLOB ||
      lcTypeName === LC_APEX_PRIMITIVE_BOOLEAN ||
      lcTypeName === LC_APEX_PRIMITIVE_DATE ||
      lcTypeName === LC_APEX_PRIMITIVE_DATETIME ||
      lcTypeName === LC_APEX_PRIMITIVE_DECIMAL ||
      lcTypeName === LC_APEX_PRIMITIVE_DOUBLE ||
      lcTypeName === LC_APEX_PRIMITIVE_ID ||
      lcTypeName === LC_APEX_PRIMITIVE_INTEGER ||
      lcTypeName === LC_APEX_PRIMITIVE_LONG ||
      lcTypeName === LC_APEX_PRIMITIVE_STRING ||
      lcTypeName === LC_APEX_PRIMITIVE_TIME
    ) {
      return true;
    }
    return false;
  }

  private isCollectionType(typeName: string): boolean {
    return (
      typeName.toLocaleLowerCase().startsWith('map<') ||
      typeName.toLocaleLowerCase().startsWith('list<') ||
      typeName.toLocaleLowerCase().startsWith('set<')
    );
  }

  // Update the leaf reference which means do not follow any reference chain. Just update
  // what is immediately on the reference.
  // refContainer: ApexVariableContainer - the container to the reference being updated
  // extentValue: HeapDumpExtentValue - the extent that contains the information/values for the ref
  // collectionType - the type of the value (for lists/maps), not the type of key.
  // Of note: when creating these leaf references there are values that will be detected as addresses
  // by the isAddress function. These will get sorted out when we're creating the variable from the reference.
  // At that time, when we try to get the reference and it doesn't exist then the value will be set and the
  // the ref field on the variable cleared.
  public updateLeafReferenceContainer(
    refContainer: ApexVariableContainer,
    extentValue: HeapDumpExtentValue,
    collectionType: string | null
  ) {
    // The collection type in the extent is either set or null. The ApexVariableContainer doesn't
    // allow null for the type, if the type isn't set or is null then default it to the empty string
    let valueCollectionType = '';
    if (collectionType) {
      valueCollectionType = collectionType;
    }
    let hasInnerRefs = false;
    // If the typename is a collection
    if (this.isCollectionType(refContainer.type)) {
      // the collection is a map
      if (extentValue.value.entry) {
        let entryNumber = 0;
        // get the map's key type and ensure key variables have their type set correctly
        const mapKeyType = this.getKeyTypeForMap(refContainer.type, collectionType ? collectionType : '');
        for (const extentValueEntry of extentValue.value.entry) {
          let keyIsRef = this.isAddress(extentValueEntry.keyDisplayValue);
          let valueIsRef = this.isAddress(extentValueEntry.value.value);
          const keyValueName = `${KEY_VALUE_PAIR_KEY}${entryNumber.toString()}_${KEY_VALUE_PAIR_VALUE}${entryNumber.toString()}`;
          const keyValueContainer = new ApexVariableContainer(keyValueName, '', KEY_VALUE_PAIR);
          // create the key variable, ensure the key's type is set
          const keyContainer = new ApexVariableContainer(KEY_VALUE_PAIR_KEY, '', mapKeyType);
          if (keyIsRef) {
            const keyRef = this.logContext.getRefsMap().get(extentValueEntry.keyDisplayValue);
            if (keyRef && keyRef.type.toLowerCase() === LC_APEX_PRIMITIVE_STRING) {
              keyIsRef = false;
              keyContainer.value = keyRef.value;
            } else {
              hasInnerRefs = true;
              keyContainer.ref = extentValueEntry.keyDisplayValue;
            }
          } else {
            keyContainer.value = extentValueEntry.keyDisplayValue.toString();
          }
          const valContainer = new ApexVariableContainer(KEY_VALUE_PAIR_VALUE, '', valueCollectionType);
          if (valueIsRef) {
            const valueRef = this.logContext.getRefsMap().get(extentValueEntry.value.value);
            if (valueRef && valueRef.type.toLowerCase() === LC_APEX_PRIMITIVE_STRING) {
              valueIsRef = false;
              valContainer.value = valueRef.value;
            } else {
              hasInnerRefs = true;
              valContainer.ref = extentValueEntry.value.value;
            }
          } else {
            valContainer.value = this.createStringFromExtentValue(extentValueEntry.value.value);
          }
          keyValueContainer.variables.set(keyContainer.name, keyContainer);
          keyValueContainer.variables.set(valContainer.name, valContainer);
          // If neither the key nor the value are references then update the
          // key's string name and set the value
          if (!keyIsRef && !valueIsRef) {
            keyValueContainer.name = keyContainer.value;
            keyValueContainer.value = valContainer.value;
          }
          // Add the key/value pair to the map
          refContainer.variables.set(keyValueName, keyValueContainer);
          entryNumber++;
        }
        // If the extentValue.value.entry doesn't exist then the collection is
        // an list/set
      } else {
        const values = extentValue.value.value;
        for (let i = 0; i < values.length; i++) {
          // If the value is an address that means that this is a reference
          if (this.isAddress(values[i].value)) {
            let valString = values[i].value;
            const valRef = this.logContext.getRefsMap().get(values[i].value);
            if (valRef && valRef.type.toLowerCase() === LC_APEX_PRIMITIVE_STRING) {
              valString = valRef.value;
            } else {
              hasInnerRefs = true;
            }
            refContainer.variables.set(
              i.toString(),
              new ApexVariableContainer(i.toString(), valString, valueCollectionType, values[i].value)
            );
          } else {
            refContainer.variables.set(
              i.toString(),
              new ApexVariableContainer(
                i.toString(),
                this.createStringFromExtentValue(values[i].value),
                valueCollectionType
              )
            );
          }
        }
      }
      // If the extent isn't for a collection then it's just an object reference
      // collect the keyDisplayValue/value pairs. The keys, in this case, should
      // not be references, they should be straight up strings for the member names.
      // The values, on the other hand, could be references
    } else {
      for (const extentValueEntry of extentValue.value.entry) {
        const valueIsRef = this.isAddress(extentValueEntry.value.value);
        if (valueIsRef) {
          let valString = extentValueEntry.value.value;
          const valRef = this.logContext.getRefsMap().get(extentValueEntry.value.value);
          if (valRef && valRef.type.toLowerCase() === LC_APEX_PRIMITIVE_STRING) {
            valString = valRef.value;
          } else {
            hasInnerRefs = true;
          }
          refContainer.variables.set(
            extentValueEntry.keyDisplayValue,
            new ApexVariableContainer(extentValueEntry.keyDisplayValue, valString, '', extentValueEntry.value.value)
          );
        } else {
          refContainer.variables.set(
            extentValueEntry.keyDisplayValue,
            new ApexVariableContainer(
              extentValueEntry.keyDisplayValue,
              this.createStringFromExtentValue(extentValueEntry.value.value),
              ''
            )
          );
        }
      }
    }
    // If the reference doesn't contain any child references then it's value can set here.
    if (!hasInnerRefs) {
      refContainer.value = this.createStringFromVarContainer(refContainer, new Set<string>());
    }
  }

  public createStringFromExtentValue(value: any): string {
    // can't toString undefined or null
    if (value === undefined) {
      return 'undefined';
    } else if (value === null) {
      return 'null';
    }
    return value.toString();
  }
  // When this is invoked, the leaf references have all been set and it is now time to
  // create the variable, piecing it together from any references.
  // The visitedMap is used to prevent circular lookups. Note: We don't actually
  // care what the value is, we just care about the key.
  public createVariableFromReference(
    varName: string,
    refVariable: ApexVariableContainer,
    visitedMap: Map<string, ApexVariableContainer | null>,
    updateAfterVarCreation: ApexVariableContainer[]
  ): ApexVariableContainer | undefined {
    // if this isn't a reference?
    if (!refVariable.ref) {
      return undefined;
    }
    // If this reference has already been seen, then there's
    // a good chance that the variable is still being created
    // and we can't reset set the value now.
    if (visitedMap.has(refVariable.ref)) {
      const visitedVar = visitedMap.get(refVariable.ref)!;
      if (visitedVar !== null) {
        if (visitedVar.name !== varName) {
          const updatedNameVarContainer = this.copyReferenceContainer(visitedVar, varName, false);
          updateAfterVarCreation.push(updatedNameVarContainer);
          return updatedNameVarContainer;
        } else {
          return visitedVar;
        }
      }
      return undefined;
    }
    try {
      // First, clone the reference into the named variable
      const namedVarContainer = this.copyReferenceContainer(refVariable, varName);
      // Create the visitedMap entry with what will be the actual
      // variable.
      visitedMap.set(refVariable.ref, namedVarContainer);

      // If the value hasn't been set yet, then we have to walk through all of the children and update
      // any child references on the variable with a recursive call
      for (const entry of Array.from(namedVarContainer.variables.entries())) {
        const childVarName = entry[0];
        const childVarContainer = entry[1];

        // If the type is KEY_VALUE_PAIR then the name/vavlue of the container are will
        // need to get updated if either of them are references. Further, the child container
        // is going to need to have it's variablesRef set so it'll expand correctly. There will
        // be exactly two immediate children in it's variables, one named 'key' and one named
        // 'value'
        if (childVarContainer.type === KEY_VALUE_PAIR) {
          // process the key
          const keyVarContainer = childVarContainer.variables.get(KEY_VALUE_PAIR_KEY);
          let keyName = keyVarContainer!.value;
          if (keyVarContainer && keyVarContainer.ref) {
            const keyRef = this.logContext.getRefsMap().get(keyVarContainer.ref);
            if (keyRef) {
              const updatedKeyVarContainer = this.createVariableFromReference(
                KEY_VALUE_PAIR_KEY,
                keyRef!,
                visitedMap,
                updateAfterVarCreation
              );
              if (updatedKeyVarContainer) {
                keyName = updatedKeyVarContainer.value;
                childVarContainer.variables.set(KEY_VALUE_PAIR_KEY, updatedKeyVarContainer);
              }
              // The value happened to match our pattern for an address but isn't in the references list.
              // Set the value to the ref value and clear the ref.
            } else {
              keyVarContainer.value = keyVarContainer.ref;
              keyVarContainer.ref = undefined;
            }
          }
          // process the value
          const valueVarContainer = childVarContainer.variables.get(KEY_VALUE_PAIR_VALUE);
          let valueVal = valueVarContainer!.value;
          if (valueVarContainer && valueVarContainer.ref) {
            const valueRef = this.logContext.getRefsMap().get(valueVarContainer.ref);
            if (valueRef) {
              const updatedValueVarContainer = this.createVariableFromReference(
                KEY_VALUE_PAIR_VALUE,
                valueRef!,
                visitedMap,
                updateAfterVarCreation
              );
              if (updatedValueVarContainer) {
                valueVal = updatedValueVarContainer.value;
                childVarContainer.variables.set(KEY_VALUE_PAIR_VALUE, updatedValueVarContainer);
              }
              // The value happened to match our pattern for an address but isn't in the references list.
              // Set the value to the ref value and clear the ref.
            } else {
              valueVarContainer.value = valueVarContainer.ref;
              valueVarContainer.ref = undefined;
            }
          }
          // get the name/value of this entity which will end up being from the values of
          // the key/value pair
          childVarContainer.name = keyName;
          childVarContainer.value = valueVal;
          // the key/value entries
          childVarContainer.variablesRef = this.logContext.getVariableHandler().create(childVarContainer);
        } else {
          // If the child isn't a reference then continue
          if (!childVarContainer.ref) {
            continue;
          }
          // At this point a recursive call needs to be made to process this child variable
          const childVarRefContainer = this.logContext.getRefsMap().get(childVarContainer.ref!);

          // The childVarRefContainer can be undefined. If this is the case then the
          // variable's value just happened to match the pattern for an address.
          if (childVarRefContainer) {
            const updatedChildContainer = this.createVariableFromReference(
              childVarName,
              childVarRefContainer!,
              visitedMap,
              updateAfterVarCreation
            );
            // update the child variable in the map
            if (updatedChildContainer) {
              namedVarContainer.variables.set(childVarName, updatedChildContainer);
            }
            // The value happened to match our pattern for an address but isn't in the references list.
            // Set the value to the ref value and clear the ref.
          } else {
            childVarContainer.value = childVarContainer.ref;
            childVarContainer.ref = undefined;
          }
        }
        namedVarContainer.value = this.createStringFromVarContainer(namedVarContainer, new Set<string>());
      }

      return namedVarContainer;
    } finally {
      // Ensure the current reference is removed from the visited map
      visitedMap.delete(refVariable.ref);
      // If the visited map is empty that means the variable is done being hooked up
      // If there are any items in the updateAfterVarCreation array then now is the
      // time to update them
      if (visitedMap.size === 0) {
        updateAfterVarCreation.forEach(varContainer => {
          varContainer.value = this.createStringFromVarContainer(varContainer, new Set<string>());
        });
      }
    }
  }

  // The typename can contain a bunch of nested types. If this is a collection of
  // collections then the collectionType won't be null.
  // typeName: the full typeName of the Map
  // collectionType: the typeName of the Map's value. This is necessary to in order to ensure
  //                 that when the type name is split that it's split correctly since, due to
  //                 potential nesting just splitting on the comma isn't good enough.
  private getKeyTypeForMap(typeName: string, collectionType: string): string {
    const lastIndexOfValue = ',' + collectionType;
    const keyTypeName = typeName.substring(typeName.indexOf('<') + 1, typeName.lastIndexOf(lastIndexOfValue));
    return keyTypeName;
  }
}
