/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import { EOL } from 'os';
import * as path from 'path';
import { FieldDeclaration, SObjectDefinition } from './types';

export const TYPESCRIPT_TYPE_EXT = '.d.ts';

export class TypingGenerator {
  public generate(
    definitions: SObjectDefinition[],
    targetFolder: string
  ): void {
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder);
    }

    for (const def of definitions) {
      if (def.name) {
        this.generateTypingForDefinition(targetFolder, def);
      }
    }
  }

  public generateTypingForDefinition(
    folderPath: string,
    definition: SObjectDefinition
  ): string {
    const typingPath = path.join(
      folderPath,
      `${definition.name}${TYPESCRIPT_TYPE_EXT}`
    );
    if (fs.existsSync(typingPath)) {
      fs.unlinkSync(typingPath);
    }

    fs.writeFileSync(typingPath, this.convertDeclarations(definition), {
      mode: 0o444
    });

    return typingPath;
  }

  private convertDeclarations(definition: SObjectDefinition): string {
    const className = definition.name;
    let declarations = Array.from(definition.fields);

    // sort, but filter out duplicates
    // which can happen due to childRelationships w/o a relationshipName
    declarations.sort((first, second): number => {
      return first.name || first.type > second.name || second.type ? 1 : -1;
    });

    declarations = declarations.filter((value, index, array): boolean => {
      return !index || value.name !== array[index - 1].name;
    });

    const declarationLines = declarations
      .filter(decl => !this.isCollectionType(decl.type))
      .map(decl => this.convertDeclaration(className, decl))
      .join(`${EOL}`);

    return declarationLines + `${EOL}`;
  }

  private isCollectionType(fieldType: string): boolean {
    return (
      fieldType.startsWith('List<') ||
      fieldType.startsWith('Set<') ||
      fieldType.startsWith('Map<')
    );
  }

  private convertDeclaration(objName: string, decl: FieldDeclaration): string {
    const typingType = this.convertType(decl.type);
    const content = `declare module "@salesforce/schema/${objName}.${decl.name}" {
  const ${decl.name}:${typingType};
  export default ${decl.name};
}`;
    return content;
  }

  private convertType(fieldType: string): string {
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
  }
}
