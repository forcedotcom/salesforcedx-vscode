/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TOOLS, createDirectory, projectPaths, safeDelete, writeFile } from '@salesforce/salesforcedx-utils-vscode';
import { EOL } from 'node:os';
import * as path from 'node:path';
import { CUSTOMOBJECTS_DIR, SOBJECTS_DIR, STANDARDOBJECTS_DIR } from '../constants';
import { SObjectsStandardAndCustom } from '../describe/types';
import { nls } from '../messages';
import { FieldDeclaration, SObjectDefinition } from '../types';
import { generateSObjectDefinition, MODIFIER } from './declarationGenerator';

export const INDENT = '    ';
const APEX_CLASS_EXTENSION = '.cls';
const REL_BASE_FOLDER = [TOOLS, SOBJECTS_DIR];

export const generateFauxClasses = async (sobjects: SObjectsStandardAndCustom): Promise<string[]> =>
  (
    await Promise.all(
      Object.entries(sobjects)
        .filter(([_, objects]) => objects.length > 0)
        .map(async ([category, objects]) => {
          const filePath = path.join(
            projectPaths.stateFolder(),
            ...REL_BASE_FOLDER,
            category === 'standard' ? STANDARDOBJECTS_DIR : CUSTOMOBJECTS_DIR
          );
          await resetOutputFolder(filePath);
          return Promise.all(objects.map(o => generateFauxClass(filePath, generateSObjectDefinition(o))));
        })
    )
  ).flat();

const resetOutputFolder = async (pathToClean: string): Promise<string> => {
  try {
    await safeDelete(pathToClean, { recursive: true, useTrash: false });
    await createDirectory(pathToClean);
    return pathToClean;
  } catch (error) {
    throw new Error(
      `Failed to reset output folder ${pathToClean}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

const fieldDeclToString = (decl: FieldDeclaration): string =>
  `${commentToString(decl.comment)}${INDENT}${decl.modifier} ${decl.type} ${decl.name};`;

// VisibleForTesting
export const commentToString = (comment?: string): string =>
  // for some reasons if the comment is on a single line the help context shows the last '*/'
  comment ? `${INDENT}/* ${comment.replace(/(\/\*+\/)|(\/\*+)|(\*+\/)/g, '')}${EOL}${INDENT}*/${EOL}` : '';

// VisibleForTesting
export const generateFauxClassText = (definition: SObjectDefinition): string => {
  // sort, but filter out duplicates
  // which can happen due to childRelationships w/o a relationshipName
  const declarations = Array.from(definition.fields ?? [])
    .sort((first, second): number => (first.name || first.type > second.name || second.type ? 1 : -1))
    .filter((value, index, array): boolean => !index || value.name !== array[index - 1].name);

  const className = definition.name;
  const classDeclaration = `${MODIFIER} class ${className} {${EOL}`;
  const declarationLines = declarations.map(fieldDeclToString).join(`${EOL}`);
  const classConstructor = `${INDENT}${MODIFIER} ${className} () ${EOL}    {${EOL}    }${EOL}`;

  const generatedClass = `${nls.localize(
    'class_header_generated_comment'
  )}${classDeclaration}${declarationLines}${EOL}${EOL}${classConstructor}}`;

  return generatedClass;
};

// VisibleForTesting
export const generateFauxClass = async (folderPath: string, definition: SObjectDefinition): Promise<string> => {
  await createDirectory(folderPath);
  const fauxClassPath = path.join(folderPath, `${definition.name}${APEX_CLASS_EXTENSION}`);
  await writeFile(fauxClassPath, generateFauxClassText(definition));
  return fauxClassPath;
};
