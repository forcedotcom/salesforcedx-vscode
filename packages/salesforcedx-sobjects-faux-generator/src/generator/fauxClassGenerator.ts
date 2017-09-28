/*
* Copyright (c) 2017, salesforce.com, inc.
* All rights reserved.
* Licensed under the BSD 3-Clause license.
* For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
*/
import * as fs from 'fs';
import * as path from 'path';

import { EOL } from 'os';
import { mkdir, rm } from 'shelljs';

import {
  ChildRelationship,
  Field,
  SObject,
  SObjectCategory,
  SObjectDescribe
} from '../describe';

export class FauxClassGenerator {
  private SFDX_DIR = '.sfdx';
  private TOOLS_DIR = 'tools';
  private SOBJECTS_DIR = 'sobjects';
  private STANDARDOBJECTS_DIR = 'standardObjects';
  private CUSTOMOBJECTS_DIR = 'customObjects';

  public async generate(
    projectPath: string,
    type: SObjectCategory
  ): Promise<string> {
    const sobjectsFolderPath = path.join(
      projectPath,
      this.SFDX_DIR,
      this.TOOLS_DIR,
      this.SOBJECTS_DIR
    );

    this.cleanupSObjectFolders(sobjectsFolderPath);

    const describe = new SObjectDescribe();
    const sobjects = await describe.describeGlobal(projectPath, type);
    const standardSObjects: SObject[] = [];
    const customSObjects: SObject[] = [];
    let fetchedSObjects: SObject[] = [];
    let j = 0;
    while (j < sobjects.length) {
      try {
        fetchedSObjects = fetchedSObjects.concat(
          await describe.describeSObjectBatch(projectPath, sobjects, j)
        );
        j = fetchedSObjects.length;
      } catch (e) {
        return Promise.reject('describe error ' + e);
      }
    }

    for (let i = 0; i < fetchedSObjects.length; i++) {
      console.log(fetchedSObjects[i].name);
      if (fetchedSObjects[i].custom) {
        customSObjects.push(fetchedSObjects[i]);
      } else {
        standardSObjects.push(fetchedSObjects[i]);
      }
    }

    this.logFetchedObjects(standardSObjects, customSObjects);

    this.generateFauxClasses(
      standardSObjects,
      path.join(sobjectsFolderPath, this.STANDARDOBJECTS_DIR)
    );
    this.generateFauxClasses(
      customSObjects,
      path.join(sobjectsFolderPath, this.CUSTOMOBJECTS_DIR)
    );

    return Promise.resolve('');
  }

  private generateChildRelationship(rel: ChildRelationship): string {
    if (rel.relationshipName) {
      return `List<${rel.childSObject}> ${rel.relationshipName}`;
    } else {
      // expect the name to end with Id, then strip off Id
      if (rel.field.endsWith('Id')) {
        const nameWithoutId = rel.field.slice(0, rel.field.length - 2);
        return `${rel.childSObject} ${nameWithoutId}`;
      } else {
        return '';
      }
    }
  }

  private generateField(field: Field): string[] {
    const decls: string[] = [];
    if (field.referenceTo.length === 0) {
      const upperCaseFirstChar = field.type.charAt(0).toUpperCase();
      decls.push(`${upperCaseFirstChar}${field.type.slice(1)} ${field.name}`);
    } else {
      if (field.referenceTo.length > 1) {
        decls.push(`SObject ${field.relationshipName}`);
      } else {
        decls.push(`${field.referenceTo} ${field.relationshipName}`);
      }
      // field.type will be "reference", but the actual type is an Id for Apex
      decls.push(`Id ${field.name}`);
    }
    return decls;
  }

  private static fieldName(decl: string) {
    return decl.substr(decl.indexOf(' ') + 1);
  }

  private generateFauxClasses(sobjects: SObject[], targetFolder: string) {
    if (!this.createIfNeededOutputFolder(targetFolder)) {
      console.log('no sobjects output folder ' + targetFolder);
      return;
    }
    for (const sobject of sobjects) {
      this.generateFauxClass(targetFolder, sobject);
    }
  }

  // VisibleForTesting
  public generateFauxClass(folderPath: string, sobject: any): string {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }
    const fauxClassPath = path.join(folderPath, sobject.name + '.cls');

    fs.writeFileSync(fauxClassPath, this.generateFauxClassText(sobject));

    return fauxClassPath;
  }

  private generateFauxClassDecls(sobject: SObject): string[] {
    const declarations: string[] = [];
    if (sobject.fields) {
      for (const field of sobject.fields) {
        const decls: string[] = this.generateField(field);
        if (decls && decls.length > 0) {
          for (const decl of decls) {
            declarations.push(decl);
          }
        }
      }
    }

    if (sobject.childRelationships) {
      for (const rel of sobject.childRelationships) {
        if (rel.relationshipName) {
          const decl: string = this.generateChildRelationship(rel);
          if (decl) {
            declarations.push(decl);
          }
        }
      }
      for (const rel of sobject.childRelationships) {
        // handle the odd childRelationships last (without relationshipName)
        if (!rel.relationshipName) {
          const decl: string = this.generateChildRelationship(rel);
          if (decl) {
            declarations.push(decl);
          }
        }
      }
    }
    return declarations;
  }

  private generateFauxClassTextFromDecls(
    className: string,
    declarations: string[]
  ): string {
    // sort, but filter out duplicates
    // which can happen due to childRelationships w/o a relationshipName
    declarations.sort((first: string, second: string): number => {
      return FauxClassGenerator.fieldName(first) >
      FauxClassGenerator.fieldName(second)
        ? 1
        : -1;
    });

    declarations = declarations.filter(
      (value: string, index: number, array: string[]): boolean => {
        return (
          !index ||
          FauxClassGenerator.fieldName(value) !==
            FauxClassGenerator.fieldName(array[index - 1])
        );
      }
    );

    const indentAndModifier = '    global ';
    const classDeclaration = `global class ${className} {${EOL}`;
    const declarationLines = declarations.join(`;${EOL}${indentAndModifier}`);
    const classConstructor = `${indentAndModifier}${className} () ${EOL}    {${EOL}    }${EOL}`;

    const generatedClass = `${classDeclaration}${indentAndModifier}${declarationLines};${EOL}${EOL}${classConstructor}}`;

    return generatedClass;
  }

  //VisibleForTesting
  public generateFauxClassText(sobject: SObject): string {
    const declarations: string[] = this.generateFauxClassDecls(sobject);
    return this.generateFauxClassTextFromDecls(sobject.name, declarations);
  }

  private createIfNeededOutputFolder(folderPath: string): boolean {
    if (!fs.existsSync(folderPath)) {
      mkdir('-p', folderPath);
      return fs.existsSync(folderPath);
    }
    return true;
  }

  private cleanupSObjectFolders(baseSObjectsFolder: string) {
    if (fs.existsSync(baseSObjectsFolder)) {
      rm('-rf', baseSObjectsFolder);
    }
  }

  private logFetchedObjects(
    standardSObjects: SObject[],
    customSObjects: SObject[]
  ) {
    if (standardSObjects.length > 0) {
      console.log(
        'Fetched ' +
          standardSObjects.length +
          ' Standard SObjects from default scratch org'
      );
    }
    if (customSObjects.length > 0) {
      console.log(
        'Fetched ' +
          customSObjects.length +
          ' Custom SObjects from default scratch org'
      );
    }
  }
}
