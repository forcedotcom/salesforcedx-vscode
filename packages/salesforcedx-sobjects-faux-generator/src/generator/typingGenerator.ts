/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import { EOL } from 'os';
import * as path from 'path';
import { rm } from 'shelljs';
import { SObject } from '../types';
import { DeclarationGenerator, FieldDeclaration } from './declarationGenerator';

export class TypingGenerator {
  private declGenerator: DeclarationGenerator;

  public constructor() {
    this.declGenerator = new DeclarationGenerator();
  }

  public generate(sobjects: SObject[], targetFolder: string): void {
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder);
    }

    for (const sobject of sobjects) {
      if (sobject.name) {
        this.generateTypingForObject(targetFolder, sobject);
      }
    }
  }

  public generateTypingForObject(folderPath: string, sobject: SObject): string {
    const typingPath = path.join(folderPath, sobject.name + '.d.ts');
    if (fs.existsSync(typingPath)) {
      rm('-rf', typingPath);
    }

    fs.writeFileSync(typingPath, this.generateTypingContent(sobject), {
      mode: 0o444
    });

    return typingPath;
  }

  public generateTypingContent(sobject: SObject): string {
    const declarations = this.declGenerator.generateFieldDeclarations(sobject);
    return this.convertDeclarations(sobject.name, declarations);
  }

  private convertDeclarations(
    className: string,
    declarations: FieldDeclaration[]
  ): string {
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
