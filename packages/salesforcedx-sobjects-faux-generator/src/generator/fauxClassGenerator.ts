/*
* Copyright (c) 2017, salesforce.com, inc.
* All rights reserved.
* Licensed under the BSD 3-Clause license.
* For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
*/
import { SFDX_PROJECT_FILE } from '@salesforce/salesforcedx-utils-vscode/out/src';
import { LocalCommandExecution } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import { EOL } from 'os';
import * as path from 'path';
import { mkdir, rm } from 'shelljs';
import {
  ChildRelationship,
  Field,
  SObject,
  SObjectCategory,
  SObjectDescribe
} from '../describe';
import { nls } from '../messages';

export interface CancellationToken {
  isCancellationRequested: boolean;
}

const SFDX_DIR = '.sfdx';
const TOOLS_DIR = 'tools';
const SOBJECTS_DIR = 'sobjects';
const STANDARDOBJECTS_DIR = 'standardObjects';
const CUSTOMOBJECTS_DIR = 'customObjects';

export class FauxClassGenerator {
  // the empty string is used to represent the need for a special case
  // usually multiple fields with specialized names
  private static typeMapping: Map<string, string> = new Map([
    ['string', 'String'],
    ['double', 'Double'],
    ['reference', ''],
    ['boolean', 'Boolean'],
    ['currency', 'Decimal'],
    ['date', 'Date'],
    ['datetime', 'Datetime'],
    ['email', 'String'],
    ['location', 'Location'],
    ['percent', 'Double'],
    ['phone', 'String'],
    ['picklist', 'String'],
    ['multipicklist', 'String'],
    ['textarea', 'String'],
    ['encryptedstring', 'String'],
    ['url', 'String'],
    ['id', 'Id'],
    // note that the mappings below "id" only occur in standard SObjects
    ['base64', 'Blob'],
    ['address', 'Address'],
    ['int', 'Integer'],
    ['anyType', 'Object'],
    ['combobox', 'String'],
    ['time', 'Time'],
    // TBD what are these mapped to and how to create them
    // ['calculated', 'xxx'],
    // ['masterrecord', 'xxx'],
    ['complexvalue', 'Object']
  ]);

  private static fieldName(decl: string): string {
    return decl.substr(decl.indexOf(' ') + 1);
  }

  private emitter: EventEmitter;
  private cancellationToken: CancellationToken | undefined;

  constructor(emitter: EventEmitter, cancellationToken?: CancellationToken) {
    this.emitter = emitter;
    this.cancellationToken = cancellationToken;
  }

  public async generate(
    projectPath: string,
    type: SObjectCategory
  ): Promise<string> {
    const sobjectsFolderPath = path.join(
      projectPath,
      SFDX_DIR,
      TOOLS_DIR,
      SOBJECTS_DIR
    );
    const standardSObjectsFolderPath = path.join(
      sobjectsFolderPath,
      STANDARDOBJECTS_DIR
    );
    const customSObjectsFolderPath = path.join(
      sobjectsFolderPath,
      CUSTOMOBJECTS_DIR
    );

    if (
      !fs.existsSync(projectPath) ||
      !fs.existsSync(path.join(projectPath, SFDX_PROJECT_FILE))
    ) {
      return this.errorExit(
        nls.localize('no_generate_if_not_in_project', sobjectsFolderPath)
      );
    }
    this.cleanupSObjectFolders(sobjectsFolderPath);

    const describe = new SObjectDescribe();
    const standardSObjects: SObject[] = [];
    const customSObjects: SObject[] = [];
    let fetchedSObjects: SObject[] = [];
    let sobjects: string[] = [];
    try {
      sobjects = await describe.describeGlobal(projectPath, type);
    } catch (e) {
      return this.errorExit(
        nls.localize('failure_fetching_sobjects_list_text', e)
      );
    }
    let j = 0;
    while (j < sobjects.length) {
      try {
        if (
          this.cancellationToken &&
          this.cancellationToken.isCancellationRequested
        ) {
          return this.cancelExit();
        }
        fetchedSObjects = fetchedSObjects.concat(
          await describe.describeSObjectBatch(projectPath, sobjects, j)
        );
        j = fetchedSObjects.length;
      } catch (e) {
        return this.errorExit(
          nls.localize('failure_in_sobject_describe_text', e)
        );
      }
    }

    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < fetchedSObjects.length; i++) {
      if (fetchedSObjects[i].custom) {
        customSObjects.push(fetchedSObjects[i]);
      } else {
        standardSObjects.push(fetchedSObjects[i]);
      }
    }

    this.logFetchedObjects(standardSObjects, customSObjects);

    try {
      this.generateFauxClasses(standardSObjects, standardSObjectsFolderPath);
    } catch (e) {
      return this.errorExit(e);
    }

    try {
      this.generateFauxClasses(customSObjects, customSObjectsFolderPath);
    } catch (e) {
      return this.errorExit(e);
    }

    return this.successExit();
  }

  // VisibleForTesting
  public generateFauxClassText(sobject: SObject): string {
    const declarations: string[] = this.generateFauxClassDecls(sobject);
    return this.generateFauxClassTextFromDecls(sobject.name, declarations);
  }

  // VisibleForTesting
  public generateFauxClass(folderPath: string, sobject: SObject): string {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }
    const fauxClassPath = path.join(folderPath, sobject.name + '.cls');
    fs.writeFileSync(fauxClassPath, this.generateFauxClassText(sobject), {
      mode: 0o444
    });
    return fauxClassPath;
  }

  private errorExit(errorMessage: string): Promise<string> {
    this.emitter.emit(LocalCommandExecution.STDERR_EVENT, `${errorMessage}\n`);
    this.emitter.emit(
      LocalCommandExecution.ERROR_EVENT,
      new Error(errorMessage)
    );
    this.emitter.emit(
      LocalCommandExecution.EXIT_EVENT,
      LocalCommandExecution.FAILURE_CODE
    );
    return Promise.reject(
      `${LocalCommandExecution.FAILURE_CODE.toString()} - ${errorMessage}`
    );
  }

  private successExit(): Promise<string> {
    this.emitter.emit(
      LocalCommandExecution.EXIT_EVENT,
      LocalCommandExecution.SUCCESS_CODE
    );
    return Promise.resolve(LocalCommandExecution.SUCCESS_CODE.toString());
  }

  private cancelExit(): Promise<string> {
    this.emitter.emit(
      LocalCommandExecution.EXIT_EVENT,
      LocalCommandExecution.FAILURE_CODE
    );
    return Promise.resolve(nls.localize('faux_generation_cancelled_text'));
  }

  private stripId(name: string): string {
    if (name.endsWith('Id')) {
      return name.slice(0, name.length - 2);
    } else {
      return name;
    }
  }

  private capitalize(input: string): string {
    return input.charAt(0).toUpperCase() + input.slice(1);
  }

  private getTargetType(describeType: string): string {
    const gentype = FauxClassGenerator.typeMapping.get(describeType) as string;
    return gentype ? gentype : this.capitalize(describeType);
  }

  private getReferenceName(relationshipName: string, name: string): string {
    return relationshipName ? relationshipName : this.stripId(name);
  }

  private generateChildRelationship(rel: ChildRelationship): string {
    const nameToUse = this.getReferenceName(rel.relationshipName, rel.field);
    return `List<${rel.childSObject}> ${nameToUse}`;
  }

  private generateField(field: Field): string[] {
    const decls: string[] = [];
    let genType = '';
    if (field.referenceTo.length === 0) {
      // should be a normal field EXCEPT for external lookup & metadata relationship
      // which is a reference, but no referenceTo targets
      if (field.extraTypeInfo === 'externallookup') {
        genType = 'String';
      } else {
        genType = this.getTargetType(field.type);
      }
      decls.push(`${genType} ${field.name}`);
    } else {
      const nameToUse = this.getReferenceName(
        field.relationshipName,
        field.name
      );
      if (field.referenceTo.length > 1) {
        decls.push(`SObject ${nameToUse}`);
      } else {
        decls.push(`${field.referenceTo} ${nameToUse}`);
      }
      // field.type will be "reference", but the actual type is an Id for Apex
      decls.push(`Id ${field.name}`);
    }
    return decls;
  }

  private generateFauxClasses(sobjects: SObject[], targetFolder: string): void {
    if (!this.createIfNeededOutputFolder(targetFolder)) {
      throw nls.localize('no_sobject_output_folder_text', targetFolder);
    }
    for (const sobject of sobjects) {
      if (sobject.name) {
        this.generateFauxClass(targetFolder, sobject);
      }
    }
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

    const generatedClass = `${nls.localize(
      'class_header_generated_comment'
    )}${classDeclaration}${indentAndModifier}${declarationLines};${EOL}${EOL}${classConstructor}}`;

    return generatedClass;
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

  private logSObjects(sobjectKind: string, fetchedLength: number) {
    if (fetchedLength > 0) {
      this.emitter.emit(
        LocalCommandExecution.STDOUT_EVENT,
        nls.localize('fetched_sobjects_length_text', fetchedLength, sobjectKind)
      );
    }
  }

  private logFetchedObjects(
    standardSObjects: SObject[],
    customSObjects: SObject[]
  ) {
    this.logSObjects('Standard', standardSObjects.length);
    this.logSObjects('Custom', customSObjects.length);
  }
}
