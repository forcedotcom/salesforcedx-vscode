/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EOL } from 'node:os';
import { FieldDeclaration, SObjectDefinition } from './types/general';

const isCollectionType = (fieldType: string): boolean =>
  fieldType.startsWith('List<') || fieldType.startsWith('Set<') || fieldType.startsWith('Map<');

const convertDeclaration = (objName: string, decl: FieldDeclaration): string => {
  const typingType = convertType(decl.type);
  return `declare module "@salesforce/schema/${objName}.${decl.name}" {
  const ${decl.name}:${typingType};
  export default ${decl.name};
}`;
};

const convertType = (fieldType: string): string => {
  switch (fieldType) {
    case 'Boolean':
      return 'boolean';
    case 'String':
      return 'string';
    case 'Decimal':
    case 'Double':
    case 'Integer':
    case 'Long':
    case 'Number':
      return 'number';
    default:
      return 'any';
  }
};

/** Returns the d.ts file content for a single SObject definition */
export const generateTypeText = (definition: SObjectDefinition): string =>
  Array.from(definition.fields)
    .filter(decl => !isCollectionType(decl.type))
    // sort, but filter out duplicates
    // which can happen due to childRelationships w/o a relationshipName
    .toSorted((first, second): number => (first.name || first.type > second.name || second.type ? 1 : -1))
    .filter((value, index, array): boolean => !index || value.name !== array[index - 1].name)
    .map(decl => convertDeclaration(definition.name, decl))
    .join(`${EOL}`)
    .concat(`${EOL}`);
