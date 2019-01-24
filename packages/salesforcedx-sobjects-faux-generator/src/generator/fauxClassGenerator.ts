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
import { Field, SObject, SObjectCategory, SObjectDescribe } from '../describe';
import { nls } from '../messages';
import { GeneratorUtil } from './fauxClassGeneratorUtil';

export interface CancellationToken {
  isCancellationRequested: boolean;
}

export class FauxClassGenerator {
  // the empty string is used to represent the need for a special case
  // usually multiple fields with specialized names
  public static typeMapping: Map<string, string> = new Map([
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
    ['complexvalue', 'Object'],
    // These mappings are for metadata "types" specifically
    ['number', 'Double'],
    ['checkbox', 'Boolean'],
    ['encryptedtext', 'String'],
    ['multiselectpicklist', 'String'],
    ['text', 'String'],
    ['longtextarea', 'String'],
    ['summary', 'Double'],
    ['autonumber', 'Double']
  ]);

  // If these field types are modified, force a remote refresh
  private static remoteRefreshTypes = new Set(['Lookup', 'MasterDetail']);

  private static fieldName(decl: string): string {
    return decl.substr(decl.indexOf(' ') + 1);
  }

  private emitter: EventEmitter;
  private cancellationToken: CancellationToken | undefined;

  constructor(emitter: EventEmitter, cancellationToken?: CancellationToken) {
    this.emitter = emitter;
    this.cancellationToken = cancellationToken;
  }

  public doLocalRefresh(
    projectPath: string,
    modifiedFilePath: string
  ): string[] | undefined {
    const pattern = /(.+(?:\/|\\)objects(?:\/|\\)\w+)((?:\/|\\)fields(?:\/|\\)\w+.field-meta.xml)?/;
    const matches = modifiedFilePath.match(pattern);
    if (matches && matches[1]) {
      const objectPath = matches[1];
      const name = path.basename(objectPath);

      if (matches[2]) {
        // This is a path to a custom field. Check if it's a type that requires remote refresh
        const modifiedField = this.getCustomField(matches[0]);
        if (modifiedField && modifiedField.referenceTo) {
          return [name, modifiedField.referenceTo[0]];
        }
      }

      const category = name.endsWith('__c')
        ? SObjectCategory.CUSTOM
        : SObjectCategory.STANDARD;
      const sobjectsPath = GeneratorUtil.getSObjectsFolder(
        projectPath,
        category
      );

      const fauxClassPath = path.join(sobjectsPath, `${name}.cls`);
      if (!fs.existsSync(fauxClassPath)) {
        return [name];
      }

      let fields = this.getStandardFields(fauxClassPath);
      const referenceFields = this.getReferenceFields(fauxClassPath);
      const customFields = this.getCustomFields(objectPath);
      const zombieRefObjects: string[] = [];
      referenceFields.forEach(rField => {
        const rBaseName = rField.name.replace('__r', '');
        const refIsZombie = !customFields.some(
          cField => rBaseName === cField.name.replace('__c', '')
        );
        if (refIsZombie) {
          zombieRefObjects.push(rField.type, name);
        }
      });
      if (zombieRefObjects.length > 0) {
        return zombieRefObjects;
      }
      fields = fields.concat(customFields);

      this.generateFauxClass(sobjectsPath, { name, fields });
    }
  }

  private getStandardFields(fauxClassPath: string): Field[] {
    return GeneratorUtil.getFieldsFromFauxClass(
      fauxClassPath,
      line => line.endsWith(';') && !line.includes('__')
    );
  }

  private getReferenceFields(fauxClassPath: string): Field[] {
    return GeneratorUtil.getFieldsFromFauxClass(fauxClassPath, line =>
      line.endsWith('__r;')
    );
  }

  private getCustomFields(objectMetadataPath: string): Field[] {
    const fields: Field[] = [];
    const fieldsPath = path.join(objectMetadataPath, 'fields');
    if (fs.existsSync(fieldsPath)) {
      fs.readdirSync(fieldsPath).forEach(fieldName => {
        const fieldPath = path.join(fieldsPath, fieldName);
        const field = this.getCustomField(fieldPath);
        if (field) {
          const { type } = field;
          if (type === 'Location') {
            // The only compound field to worry about
            const { name } = field;
            const longName = name.replace('__c', '__longitude__s');
            const latName = name.replace('__c', '__latitude__s');
            fields.push(
              { name: longName, type: 'double' },
              { name: latName, type: 'double' }
            );
          } else {
            fields.push(field);
          }
        }
      });
    }
    return fields;
  }

  private getCustomField(fieldPath: string): Field | undefined {
    if (fs.existsSync(fieldPath)) {
      const fileContents = fs.readFileSync(fieldPath).toString();
      const nameAndType = fileContents.match(
        /<fullName>(\w+__c)<\/fullName>(?:.|\n)*<type>(\w+)<\/type>/
      );
      if (nameAndType && nameAndType[1] && nameAndType[2]) {
        const field: Field = { name: nameAndType[1], type: nameAndType[2] };
        const refMatch = fileContents.match(
          /<referenceTo>(\w+)<\/referenceTo>/
        );
        if (refMatch && refMatch[1]) {
          field.referenceTo = [refMatch[1]];
        }
        return field;
      }
    }
  }

  public async generateByCategory(
    projectPath: string,
    type: SObjectCategory
  ): Promise<string> {
    let sobjects: string[] = [];
    const describe = new SObjectDescribe();
    try {
      sobjects = await describe.describeGlobal(projectPath, type);
    } catch (e) {
      return this.errorExit(
        nls.localize('failure_fetching_sobjects_list_text', e)
      );
    }
    const sobjectFolder = GeneratorUtil.getSObjectsFolder(projectPath, type);
    GeneratorUtil.cleanupSObjectFolders(sobjectFolder);
    return this.generate(projectPath, sobjects);
  }

  public async generate(
    projectPath: string,
    sobjects: string[]
  ): Promise<string> {
    if (
      !fs.existsSync(projectPath) ||
      !fs.existsSync(path.join(projectPath, SFDX_PROJECT_FILE))
    ) {
      return this.errorExit(
        nls.localize(
          'no_generate_if_not_in_project',
          GeneratorUtil.getSObjectsFolder(projectPath)
        )
      );
    }

    const describe = new SObjectDescribe();
    const standardSObjects: SObject[] = [];
    const customSObjects: SObject[] = [];
    let fetchedSObjects: SObject[] = [];

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
      const standardFolderPath = GeneratorUtil.getSObjectsFolder(
        projectPath,
        SObjectCategory.STANDARD
      );
      this.generateFauxClasses(standardSObjects, standardFolderPath);
    } catch (e) {
      return this.errorExit(e);
    }

    try {
      const customFolderPath = GeneratorUtil.getSObjectsFolder(
        projectPath,
        SObjectCategory.CUSTOM
      );
      this.generateFauxClasses(customSObjects, customFolderPath);
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
    if (fs.existsSync(fauxClassPath)) {
      rm('-f', fauxClassPath);
    }
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

  private generateField(field: Field): string[] {
    const decls: string[] = [];
    let genType = '';
    const { name, referenceTo, extraTypeInfo } = field;
    if (!referenceTo || referenceTo.length === 0) {
      // should be a normal field EXCEPT for external lookup & metadata relationship
      // which is a reference, but no referenceTo targets
      if (extraTypeInfo && extraTypeInfo === 'externallookup') {
        genType = 'String';
      } else {
        genType = GeneratorUtil.getTargetType(field.type);
      }
      decls.push(`${genType} ${name}`);
    } else {
      const nameToUse = GeneratorUtil.getReferenceName(
        field.relationshipName!,
        name
      );
      if (referenceTo.length > 1) {
        decls.push(`SObject ${nameToUse}`);
      } else {
        decls.push(`${referenceTo} ${nameToUse}`);
      }
      // field.type will be "reference", but the actual type is an Id for Apex
      decls.push(`Id ${name}`);
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
          const decl: string = GeneratorUtil.generateChildRelationship(rel);
          if (decl) {
            declarations.push(decl);
          }
        }
      }
      for (const rel of sobject.childRelationships) {
        // handle the odd childRelationships last (without relationshipName)
        if (!rel.relationshipName) {
          const decl: string = GeneratorUtil.generateChildRelationship(rel);
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
