/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createDirectory, projectPaths, safeDelete, writeFile } from '@salesforce/salesforcedx-utils-vscode';
import { EOL } from 'node:os';
import * as path from 'node:path';
import { SObjectsStandardAndCustom } from '../describe/types';
import { FieldDeclaration, SObject, SObjectDefinition, SObjectGenerator, SObjectRefreshOutput } from '../types';
import { generateSObjectDefinition } from './declarationGenerator';

const TYPESCRIPT_TYPE_EXT = '.d.ts';
const TYPING_PATH = ['typings', 'lwc', 'sobjects'];

export class TypingGenerator implements SObjectGenerator {
  public async generate(output: SObjectRefreshOutput): Promise<void> {
    const typingsFolderPath = path.join(output.sfdxPath, ...TYPING_PATH);
    await generateTypes([...output.getStandard(), ...output.getCustom()], typingsFolderPath);
  }
}

export const generateAllTypes = async (sobjects: SObjectsStandardAndCustom) => {
  const typingsFolderPath = path.join(projectPaths.stateFolder(), ...TYPING_PATH);
  await generateTypes([...sobjects.standard, ...sobjects.custom], typingsFolderPath);
};

const generateTypes = async (sobjects: SObject[], targetFolder: string): Promise<void> => {
  await createDirectory(targetFolder);

  await Promise.all(
    sobjects
      .filter(o => o.name)
      .map(o => generateSObjectDefinition(o))
      .map(o => generateType(targetFolder, o))
  );
};
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

const convertDeclarations = (definition: SObjectDefinition): string =>
  Array.from(definition.fields)
    .filter(decl => !isCollectionType(decl.type))
    // sort, but filter out duplicates
    // which can happen due to childRelationships w/o a relationshipName
    .sort((first, second): number => (first.name || first.type > second.name || second.type ? 1 : -1))
    .filter((value, index, array): boolean => !index || value.name !== array[index - 1].name)
    .map(decl => convertDeclaration(definition.name, decl))
    .join(`${EOL}`)
    .concat(`${EOL}`);

/** delete the existing file and write a new one for each sobject */
export const generateType = async (folderPath: string, definition: SObjectDefinition): Promise<string> => {
  const typingPath = path.join(folderPath, `${definition.name}${TYPESCRIPT_TYPE_EXT}`);
  await safeDelete(typingPath);
  await writeFile(typingPath, convertDeclarations(definition));
  return typingPath;
};
