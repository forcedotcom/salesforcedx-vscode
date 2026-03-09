/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EOL } from 'node:os';
import { MODIFIER } from './declarationGenerator';
import { FieldDeclaration, SObjectDefinition } from './types/general';

export const INDENT = '    ';

const CLASS_HEADER_COMMENT = `// This file is generated as an Apex representation of the
//     corresponding sObject and its fields.
// This read-only file is used by the Apex Language Server to
//     provide code smartness, and is deleted each time you
//     refresh your sObject definitions.
// To edit your sObjects and their fields, edit the corresponding
//     .object-meta.xml and .field-meta.xml files.

`;

const fieldDeclToString = (decl: FieldDeclaration): string =>
  `${commentToString(decl.comment)}${INDENT}${decl.modifier} ${decl.type} ${decl.name};`;

// VisibleForTesting
export const commentToString = (comment?: string): string =>
  // for some reasons if the comment is on a single line the help context shows the last '*/'
  comment ? `${INDENT}/* ${comment.replaceAll(/(\/\*+\/)|(\/\*+)|(\*+\/)/g, '')}${EOL}${INDENT}*/${EOL}` : '';

// VisibleForTesting
export const generateFauxClassText = (definition: SObjectDefinition): string => {
  // sort, but filter out duplicates
  // which can happen due to childRelationships w/o a relationshipName
  const declarations = Array.from(definition.fields ?? [])
    .toSorted((first, second): number => (first.name || first.type > second.name || second.type ? 1 : -1))
    .filter((value, index, array): boolean => !index || value.name !== array[index - 1].name);

  const className = definition.name;
  const classDeclaration = `${MODIFIER} class ${className} {${EOL}`;
  const declarationLines = declarations.map(fieldDeclToString).join(`${EOL}`);
  const classConstructor = `${INDENT}${MODIFIER} ${className} () ${EOL}    {${EOL}    }${EOL}`;

  return `${CLASS_HEADER_COMMENT}${classDeclaration}${declarationLines}${EOL}${EOL}${classConstructor}}`;
};
