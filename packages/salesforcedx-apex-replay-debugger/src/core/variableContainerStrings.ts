/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ApexVariableContainer } from '../adapter/variableContainer';
import { LC_APEX_PRIMITIVE_STRING } from '../constants';

export const isCollectionType = (typeName: string): boolean =>
  typeName.toLocaleLowerCase().startsWith('map<') ||
  typeName.toLocaleLowerCase().startsWith('list<') ||
  typeName.toLocaleLowerCase().startsWith('set<');

// The way the variables are displayed in the variable's window is <varName>:<value>
// and the value is basically a 'toString' of the variable. This is easy enough for
// primitive types but for things like collections it ends up being something like
// MyStrList: ('1','2','3') which when expanded looks like
// MyStrList: ('1','2','3')
//   0: '1'
//   1: '2'
//   2: '3'
/** build the display string for a variable container, recursing into nested references */
export const createStringFromVarContainer = (varContainer: ApexVariableContainer, visitedSet: Set<string>): string => {
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
    const containerType = isCollectionType(varContainer.type) ? '' : `${varContainer.type}:`;
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
        returnString += createStringFromVarContainer(valueAsApexVar, visitedSet);
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
};
