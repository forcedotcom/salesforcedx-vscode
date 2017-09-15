/*
* Copyright (c) 2017, salesforce.com, inc.
* All rights reserved.
* Licensed under the BSD 3-Clause license.
* For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
*/
import * as fs from 'fs';
import * as path from 'path';
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

  public async generate(
    projectPath: string,
    type: SObjectCategory
  ): Promise<string> {
    const describe = new SObjectDescribe();
    const sobjects = await describe.describeGlobal(projectPath, type);
    const standardSObjects: SObject[] = [];
    const customSObjects: SObject[] = [];
    let fetchedSObjects: SObject[] = [];
    let j = 0;
    while (j < sobjects.length) {
      try {
        fetchedSObjects = fetchedSObjects.concat(
          await describe.describeSObjectBatch(projectPath, sobjects, j - 1)
        );
        j = fetchedSObjects.length;
      } catch (e) {
        Promise.reject('describe error ' + e);
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

    const standardSObjectFolderPath = path.join(
      projectPath,
      this.SFDX_DIR,
      this.TOOLS_DIR,
      this.SOBJECTS_DIR,
      'standardObjects'
    );
    const customSObjectFolderPath = path.join(
      projectPath,
      this.SFDX_DIR,
      this.TOOLS_DIR,
      this.SOBJECTS_DIR,
      'customObjects'
    );

    for (const sobject of standardSObjects) {
      await this.generateFauxClass(standardSObjectFolderPath, sobject);
    }
    for (const sobject of customSObjects) {
      await this.generateFauxClass(customSObjectFolderPath, sobject);
    }

    return '';
  }

  private generateChildRelationship(rel: ChildRelationship): string {
    if (rel.relationshipName) {
      return 'List<' + rel.childSObject + '> ' + rel.relationshipName;
    } else {
      // expect the name to end with Id, then strip off Id
      if (rel.field.endsWith('Id')) {
        return (
          rel.childSObject + ' ' + rel.field.slice(0, rel.field.length - 2)
        );
      } else {
        return '';
      }
    }
  }

  private generateField(field: Field): string[] {
    const decls: string[] = [];
    if (field.referenceTo.length === 0) {
      decls.push(
        field.type.charAt(0).toUpperCase() +
          field.type.slice(1) +
          ' ' +
          field.name
      );
    } else {
      if (field.referenceTo.length > 1) {
        decls.push('SObject' + ' ' + field.relationshipName);
      } else {
        decls.push(field.referenceTo + ' ' + field.relationshipName);
      }
      // field.type will be "reference", but the actual type is an Id for Apex
      decls.push('Id ' + field.name);
    }
    return decls;
  }

  private static fieldName(decl: string) {
    return decl.substr(decl.indexOf(' ') + 1);
  }

  // VisibleForTesting
  public async generateFauxClass(
    folderPath: string,
    sobject: any
  ): Promise<string> {
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
    declarations.sort(function nameCompare(
      first: string,
      second: string
    ): number {
      return FauxClassGenerator.fieldName(first) >
      FauxClassGenerator.fieldName(second)
        ? 1
        : -1;
    });

    declarations = declarations.filter(function checkDups(
      value: string,
      index: number,
      array: string[]
    ) {
      return (
        !index ||
        FauxClassGenerator.fieldName(value) !==
          FauxClassGenerator.fieldName(array[index - 1])
      );
    });

    const indentAndModifier = '    global ';
    const generatedClass: string =
      'global class ' +
      className +
      ' \n{\n' +
      indentAndModifier +
      declarations.join(';\n' + indentAndModifier) +
      ';\n\n' +
      indentAndModifier +
      className +
      ' () \n    {\n    }\n}';

    return generatedClass;
  }

  //VisibleForTesting
  public generateFauxClassText(sobject: SObject): string {
    const declarations: string[] = this.generateFauxClassDecls(sobject);
    return this.generateFauxClassTextFromDecls(sobject.name, declarations);
  }
}
