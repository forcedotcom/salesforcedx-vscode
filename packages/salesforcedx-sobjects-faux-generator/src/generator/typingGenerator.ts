/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createDirectory, safeDelete, writeFile } from '@salesforce/salesforcedx-utils-vscode';
import { EOL } from 'node:os';
import * as path from 'node:path';
import { FieldDeclaration, SObject, SObjectDefinition, SObjectGenerator, SObjectRefreshOutput } from '../types';
import { generateSObjectDefinition } from './declarationGenerator';

const TYPESCRIPT_TYPE_EXT = '.d.ts';
const TYPING_PATH = ['typings', 'lwc', 'sobjects'];

export class TypingGenerator implements SObjectGenerator {
  public constructor() {}

  public async generate(output: SObjectRefreshOutput): Promise<void> {
    const typingsFolderPath = path.join(output.sfdxPath, ...TYPING_PATH);
    await this.generateTypes([...output.getStandard(), ...output.getCustom()], typingsFolderPath);
  }

  public async generateTypes(sobjects: SObject[], targetFolder: string): Promise<void> {
    await createDirectory(targetFolder);

    for (const sobj of sobjects) {
      if (sobj.name) {
        const sobjDefinition = generateSObjectDefinition(sobj);
        await this.generateType(targetFolder, sobjDefinition);
      }
    }
  }

  public async generateType(folderPath: string, definition: SObjectDefinition): Promise<string> {
    const typingPath = path.join(folderPath, `${definition.name}${TYPESCRIPT_TYPE_EXT}`);
    await safeDelete(typingPath);
    await writeFile(typingPath, this.convertDeclarations(definition));

    return typingPath;
  }

  private convertDeclarations(definition: SObjectDefinition): string {
    const className = definition.name;
    let declarations = Array.from(definition.fields);

    // sort, but filter out duplicates
    // which can happen due to childRelationships w/o a relationshipName
    declarations.sort((first, second): number => (first.name || first.type > second.name || second.type ? 1 : -1));

    declarations = declarations.filter(
      (value, index, array): boolean => !index || value.name !== array[index - 1].name
    );

    const declarationLines = declarations
      .filter(decl => !this.isCollectionType(decl.type))
      .map(decl => this.convertDeclaration(className, decl))
      .join(`${EOL}`);

    return declarationLines + `${EOL}`;
  }

  private isCollectionType(fieldType: string): boolean {
    return fieldType.startsWith('List<') || fieldType.startsWith('Set<') || fieldType.startsWith('Map<');
  }

  private convertDeclaration(objName: string, decl: FieldDeclaration): string {
    const typingType = convertType(decl.type);
    const content = `declare module "@salesforce/schema/${objName}.${decl.name}" {
  const ${decl.name}:${typingType};
  export default ${decl.name};
}`;
    return content;
  }
}

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
  }
  return 'any';
};
