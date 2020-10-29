/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core';
import { LocalCommandExecution } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { SFDX_PROJECT_FILE } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import { EOL } from 'os';
import * as path from 'path';
import { mkdir, rm } from 'shelljs';
import {
  CUSTOMOBJECTS_DIR,
  SFDX_DIR,
  SOBJECTS_DIR,
  STANDARDOBJECTS_DIR,
  TOOLS_DIR
} from '../constants';
import {
  ChildRelationship,
  Field,
  SObject,
  SObjectCategory,
  SObjectDescribe
} from '../describe';
import { ConfigUtil } from '../describe/configUtil';
import { nls } from '../messages';

export const INDENT = '    ';
const MODIFIER = 'global';
const startupMinSObjects = [
  'Account',
  'Attachment',
  'Case',
  'Contact',
  'Contract',
  'Lead',
  'Note',
  'Opportunity',
  'Order',
  'Pricebook2',
  'PricebookEntry',
  'Product2',
  'RecordType',
  'Report',
  'Task',
  'User'
];
export interface CancellationToken {
  isCancellationRequested: boolean;
}

export enum SObjectRefreshSource {
  Manual = 'manual',
  Startup = 'startup',
  StartupMin = 'startupmin'
}

export interface FieldDeclaration {
  modifier: string;
  type: string;
  name: string;
  comment?: string;
}

export interface SObjectRefreshResult {
  data: {
    category?: SObjectCategory;
    source?: SObjectRefreshSource;
    cancelled: boolean;
    standardObjects?: number;
    customObjects?: number;
  };
  error?: { message: string; stack?: string };
}

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

  private static fieldDeclToString(decl: FieldDeclaration): string {
    return `${FauxClassGenerator.commentToString(decl.comment)}${INDENT}${
      decl.modifier
    } ${decl.type} ${decl.name};`;
  }

  // VisibleForTesting
  public static commentToString(comment?: string): string {
    // for some reasons if the comment is on a single line the help context shows the last '*/'
    return comment
      ? `${INDENT}/* ${comment.replace(
          /(\/\*+\/)|(\/\*+)|(\*+\/)/g,
          ''
        )}${EOL}${INDENT}*/${EOL}`
      : '';
  }

  private emitter: EventEmitter;
  private cancellationToken: CancellationToken | undefined;
  private result: SObjectRefreshResult;

  constructor(emitter: EventEmitter, cancellationToken?: CancellationToken) {
    this.emitter = emitter;
    this.cancellationToken = cancellationToken;
    this.result = { data: { cancelled: false } };
  }

  public async generate(
    projectPath: string,
    type: SObjectCategory,
    source: SObjectRefreshSource
  ): Promise<SObjectRefreshResult> {
    this.result = { data: { category: type, source, cancelled: false } };
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
    this.cleanupSObjectFolders(sobjectsFolderPath, type);

    const connection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: await ConfigUtil.getUsername(projectPath)
      })
    });

    const describe = new SObjectDescribe(connection);
    const standardSObjects: SObject[] = [];
    const customSObjects: SObject[] = [];
    let fetchedSObjects: SObject[] = [];
    let sobjects: string[] = [];
    try {
      sobjects = await describe.describeGlobal(projectPath, type);
    } catch (e) {
      const err = JSON.parse(e);
      return this.errorExit(
        nls.localize('failure_fetching_sobjects_list_text', err.message),
        err.stack
      );
    }
    const filteredSObjects = sobjects.filter(this.isRequiredSObject);
    let j = 0;
    while (j < filteredSObjects.length) {
      try {
        if (
          this.cancellationToken &&
          this.cancellationToken.isCancellationRequested
        ) {
          return this.cancelExit();
        }
        fetchedSObjects = fetchedSObjects.concat(
          await describe.describeSObjectBatch(filteredSObjects, j)
        );
        j = fetchedSObjects.length;
      } catch (errorMessage) {
        return this.errorExit(
          nls.localize('failure_in_sobject_describe_text', errorMessage)
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

    this.result.data.standardObjects = standardSObjects.length;
    this.result.data.customObjects = customSObjects.length;

    this.logFetchedObjects(standardSObjects, customSObjects);

    try {
      this.generateFauxClasses(standardSObjects, standardSObjectsFolderPath);
    } catch (errorMessage) {
      return this.errorExit(errorMessage);
    }

    try {
      this.generateFauxClasses(customSObjects, customSObjectsFolderPath);
    } catch (errorMessage) {
      return this.errorExit(errorMessage);
    }

    return this.successExit();
  }

  public async generateMin(
    projectPath: string,
    source: SObjectRefreshSource
  ): Promise<SObjectRefreshResult> {
    this.result = {
      data: { category: SObjectCategory.STANDARD, source, cancelled: false }
    };
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

    if (
      !fs.existsSync(projectPath) ||
      !fs.existsSync(path.join(projectPath, SFDX_PROJECT_FILE))
    ) {
      return this.errorExit(
        nls.localize('no_generate_if_not_in_project', sobjectsFolderPath)
      );
    }
    this.cleanupSObjectFolders(sobjectsFolderPath, SObjectCategory.STANDARD);

    const connection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: await ConfigUtil.getUsername(projectPath)
      })
    });

    const describe = new SObjectDescribe(connection);
    const standardSObjects: SObject[] = [];
    let fetchedSObjects: SObject[] = [];
    let j = 0;
    while (j < startupMinSObjects.length) {
      try {
        if (
          this.cancellationToken &&
          this.cancellationToken.isCancellationRequested
        ) {
          return this.cancelExit();
        }
        fetchedSObjects = fetchedSObjects.concat(
          await describe.describeSObjectBatch(startupMinSObjects, j)
        );
        j = fetchedSObjects.length;
      } catch (errorMessage) {
        return this.errorExit(
          nls.localize('failure_in_sobject_describe_text', errorMessage)
        );
      }
    }

    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < fetchedSObjects.length; i++) {
      standardSObjects.push(fetchedSObjects[i]);
    }

    this.result.data.standardObjects = standardSObjects.length;
    this.result.data.customObjects = 0;

    this.logFetchedObjects(standardSObjects, []);

    try {
      this.generateFauxClasses(standardSObjects, standardSObjectsFolderPath);
    } catch (errorMessage) {
      return this.errorExit(errorMessage);
    }

    return this.successExit();
  }

  // VisibleForTesting
  public isRequiredSObject(sobject: string): boolean {
    // Ignore all sobjects that end with Share or History or Feed or Event
    return !/Share$|History$|Feed$|Event$/.test(sobject);
  }

  // VisibleForTesting
  public generateFauxClassText(sobject: SObject): string {
    const declarations: FieldDeclaration[] = this.generateFauxClassDecls(
      sobject
    );
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

  // VisibleForTesting
  public cleanupSObjectFolders(
    baseSObjectsFolder: string,
    type: SObjectCategory
  ) {
    let pathToClean;
    switch (type) {
      case SObjectCategory.STANDARD:
        pathToClean = path.join(baseSObjectsFolder, STANDARDOBJECTS_DIR);
        break;
      case SObjectCategory.CUSTOM:
        pathToClean = path.join(baseSObjectsFolder, CUSTOMOBJECTS_DIR);
        break;
      default:
        pathToClean = baseSObjectsFolder;
    }
    if (fs.existsSync(pathToClean)) {
      rm('-rf', pathToClean);
    }
  }

  private errorExit(
    message: string,
    stack?: string
  ): Promise<SObjectRefreshResult> {
    this.emitter.emit(LocalCommandExecution.STDERR_EVENT, `${message}\n`);
    this.emitter.emit(LocalCommandExecution.ERROR_EVENT, new Error(message));
    this.emitter.emit(
      LocalCommandExecution.EXIT_EVENT,
      LocalCommandExecution.FAILURE_CODE
    );
    this.result.error = { message, stack };
    return Promise.reject(this.result);
  }

  private successExit(): Promise<SObjectRefreshResult> {
    this.emitter.emit(
      LocalCommandExecution.EXIT_EVENT,
      LocalCommandExecution.SUCCESS_CODE
    );
    return Promise.resolve(this.result);
  }

  private cancelExit(): Promise<SObjectRefreshResult> {
    this.emitter.emit(
      LocalCommandExecution.EXIT_EVENT,
      LocalCommandExecution.FAILURE_CODE
    );
    this.result.data.cancelled = true;
    return Promise.resolve(this.result);
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

  private generateChildRelationship(rel: ChildRelationship): FieldDeclaration {
    const name = this.getReferenceName(rel.relationshipName, rel.field);
    return {
      modifier: MODIFIER,
      type: `List<${rel.childSObject}>`,
      name
    };
  }

  private generateField(field: Field): FieldDeclaration[] {
    const decls: FieldDeclaration[] = [];
    const comment = field.inlineHelpText;
    let genType = '';
    if (field.referenceTo.length === 0) {
      // should be a normal field EXCEPT for external lookup & metadata relationship
      // which is a reference, but no referenceTo targets
      if (field.extraTypeInfo === 'externallookup') {
        genType = 'String';
      } else {
        genType = this.getTargetType(field.type);
      }

      decls.push({
        modifier: MODIFIER,
        type: genType,
        name: field.name,
        comment
      });
    } else {
      const name = this.getReferenceName(field.relationshipName, field.name);

      decls.push({
        modifier: MODIFIER,
        name,
        type: field.referenceTo.length > 1 ? 'SObject' : `${field.referenceTo}`,
        comment
      });
      // field.type will be "reference", but the actual type is an Id for Apex
      decls.push({
        modifier: MODIFIER,
        name: field.name,
        type: 'Id',
        comment
      });
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

  private generateFauxClassDecls(sobject: SObject): FieldDeclaration[] {
    const declarations: FieldDeclaration[] = [];
    if (sobject.fields) {
      for (const field of sobject.fields) {
        const decls: FieldDeclaration[] = this.generateField(field);
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
          const decl: FieldDeclaration = this.generateChildRelationship(rel);
          if (decl) {
            declarations.push(decl);
          }
        }
      }
      for (const rel of sobject.childRelationships) {
        // handle the odd childRelationships last (without relationshipName)
        if (!rel.relationshipName) {
          const decl: FieldDeclaration = this.generateChildRelationship(rel);
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

    const classDeclaration = `${MODIFIER} class ${className} {${EOL}`;
    const declarationLines = declarations
      .map(FauxClassGenerator.fieldDeclToString)
      .join(`${EOL}`);
    const classConstructor = `${INDENT}${MODIFIER} ${className} () ${EOL}    {${EOL}    }${EOL}`;

    const generatedClass = `${nls.localize(
      'class_header_generated_comment'
    )}${classDeclaration}${declarationLines}${EOL}${EOL}${classConstructor}}`;

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
