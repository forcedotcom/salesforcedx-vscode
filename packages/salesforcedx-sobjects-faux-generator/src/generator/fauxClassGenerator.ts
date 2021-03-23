/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import { EOL } from 'os';
import * as path from 'path';
import { mkdir, rm } from 'shelljs';
import * as minSObjectsFromFile from '../../src/data/minSObjects.json';
import {
  CUSTOMOBJECTS_DIR,
  ERROR_EVENT,
  EXIT_EVENT,
  FAILURE_CODE,
  SFDX_DIR,
  SFDX_PROJECT_FILE,
  SOBJECTS_DIR,
  STANDARDOBJECTS_DIR,
  STDERR_EVENT,
  STDOUT_EVENT,
  SUCCESS_CODE,
  TOOLS_DIR
} from '../constants';
import { SObjectDescribe } from '../describe';
import { nls } from '../messages';
import { SObject, SObjectCategory, SObjectRefreshSource } from '../types';
import { ConfigUtil } from './configUtil';
import { DeclarationGenerator, MODIFIER } from './declarationGenerator';
import { FieldDeclaration, SObjectDefinition } from './types';
import { TypingGenerator } from './typingGenerator';

const TYPING_PATH = ['typings', 'lwc', 'sobjects'];
export const INDENT = '    ';
export const APEX_CLASS_EXTENSION = '.cls';

export interface CancellationToken {
  isCancellationRequested: boolean;
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
  private shouldGenerateTypes = false;

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
  private typingGenerator: TypingGenerator;
  private declGenerator: DeclarationGenerator;

  constructor(emitter: EventEmitter, cancellationToken?: CancellationToken) {
    this.emitter = emitter;
    this.cancellationToken = cancellationToken;
    this.result = { data: { cancelled: false } };
    this.typingGenerator = new TypingGenerator();
    this.declGenerator = new DeclarationGenerator();
  }

  public async generate(
    projectPath: string,
    category: SObjectCategory,
    source: SObjectRefreshSource
  ): Promise<SObjectRefreshResult> {
    this.result = { data: { category, source, cancelled: false } };
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
    const typingsFolderPath = path.join(projectPath, SFDX_DIR, ...TYPING_PATH);

    if (
      !fs.existsSync(projectPath) ||
      !fs.existsSync(path.join(projectPath, SFDX_PROJECT_FILE))
    ) {
      return this.errorExit(
        nls.localize('no_generate_if_not_in_project', sobjectsFolderPath)
      );
    }
    this.cleanupSObjectFolders(sobjectsFolderPath, category);

    const connection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: await ConfigUtil.getUsername(projectPath)
      })
    });
    const describe = new SObjectDescribe(connection);

    let sobjects: string[] = [];
    try {
      sobjects = await describe.describeGlobal(category, source);
    } catch (e) {
      const err = JSON.parse(e);
      return this.errorExit(
        nls.localize('failure_fetching_sobjects_list_text', err.message),
        err.stack
      );
    }

    if (
      this.cancellationToken &&
      this.cancellationToken.isCancellationRequested
    ) {
      return this.cancelExit();
    }

    let fetchedSObjects: SObject[] = [];
    try {
      fetchedSObjects = await describe.fetchObjects(sobjects);
    } catch (errorMessage) {
      return this.errorExit(
        nls.localize('failure_in_sobject_describe_text', errorMessage)
      );
    }

    const standardSObjects: SObjectDefinition[] = [];
    const customSObjects: SObjectDefinition[] = [];
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < fetchedSObjects.length; i++) {
      if (fetchedSObjects[i].custom) {
        customSObjects.push(
          this.declGenerator.generateSObjectDefinition(fetchedSObjects[i])
        );
      } else {
        standardSObjects.push(
          this.declGenerator.generateSObjectDefinition(fetchedSObjects[i])
        );
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

    if (this.shouldGenerateTypes) {
      try {
        this.typingGenerator.generate(
          [...standardSObjects, ...customSObjects],
          typingsFolderPath
        );
      } catch (errorMessage) {
        return this.errorExit(errorMessage);
      }
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
    const typingsFolderPath = path.join(projectPath, SFDX_DIR, ...TYPING_PATH);

    if (
      !fs.existsSync(projectPath) ||
      !fs.existsSync(path.join(projectPath, SFDX_PROJECT_FILE))
    ) {
      return this.errorExit(
        nls.localize('no_generate_if_not_in_project', sobjectsFolderPath)
      );
    }
    this.cleanupSObjectFolders(sobjectsFolderPath, SObjectCategory.STANDARD);

    if (
      this.cancellationToken &&
      this.cancellationToken.isCancellationRequested
    ) {
      return this.cancelExit();
    }

    if (!this.createIfNeededOutputFolder(standardSObjectsFolderPath)) {
      throw nls.localize(
        'no_sobject_output_folder_text',
        standardSObjectsFolderPath
      );
    }

    const sobjectDecl: SObjectDefinition[] = this.getSObjectSubsetDefinitions();
    this.generateAndWriteFauxClasses(sobjectDecl, standardSObjectsFolderPath);
    this.result.data.standardObjects = sobjectDecl.length;
    this.logSObjects('Standard', sobjectDecl.length);

    if (this.shouldGenerateTypes) {
      try {
        this.typingGenerator.generate(sobjectDecl, typingsFolderPath);
      } catch (errorMessage) {
        return this.errorExit(errorMessage);
      }
    }

    return this.successExit();
  }

  // VisibleForTesting
  public generateAndWriteFauxClasses(
    sobjectDecl: SObjectDefinition[],
    standardSObjectsFolderPath: string
  ) {
    // This method is different from generateFauxClasses -  generateFauxClasses takes SObject array as input
    // and to generate that we would need a large definition file. If we go one level more specific, as what
    // generateAndWriteFauxClasses here requires, simpler declarations we have in the minSObjects.json is good.
    for (const sobject of sobjectDecl) {
      const fauxClassPath = path.join(
        standardSObjectsFolderPath,
        `${sobject.name}${APEX_CLASS_EXTENSION}`
      );
      sobject.fields.forEach(field => {
        field.modifier = MODIFIER;
      });
      fs.writeFileSync(fauxClassPath, this.generateFauxClassText(sobject), {
        mode: 0o444
      });
    }
  }

  // VisibleForTesting
  public getSObjectSubsetDefinitions(): SObjectDefinition[] {
    return minSObjectsFromFile as SObjectDefinition[];
  }

  // VisibleForTesting
  public generateFauxClass(
    folderPath: string,
    definition: SObjectDefinition
  ): string {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }
    const fauxClassPath = path.join(
      folderPath,
      `${definition.name}${APEX_CLASS_EXTENSION}`
    );
    fs.writeFileSync(fauxClassPath, this.generateFauxClassText(definition), {
      mode: 0o444
    });
    return fauxClassPath;
  }

  // VisibleForTesting
  public cleanupSObjectFolders(
    baseSObjectsFolder: string,
    category: SObjectCategory
  ) {
    let pathToClean;
    switch (category) {
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
    this.emitter.emit(STDERR_EVENT, `${message}\n`);
    this.emitter.emit(ERROR_EVENT, new Error(message));
    this.emitter.emit(EXIT_EVENT, FAILURE_CODE);
    this.result.error = { message, stack };
    return Promise.reject(this.result);
  }

  private successExit(): Promise<SObjectRefreshResult> {
    this.emitter.emit(EXIT_EVENT, SUCCESS_CODE);
    return Promise.resolve(this.result);
  }

  private cancelExit(): Promise<SObjectRefreshResult> {
    this.emitter.emit(EXIT_EVENT, FAILURE_CODE);
    this.result.data.cancelled = true;
    return Promise.resolve(this.result);
  }

  private generateFauxClasses(
    definitions: SObjectDefinition[],
    targetFolder: string
  ): void {
    if (!this.createIfNeededOutputFolder(targetFolder)) {
      throw nls.localize('no_sobject_output_folder_text', targetFolder);
    }

    for (const objDef of definitions) {
      if (objDef.name) {
        this.generateFauxClass(targetFolder, objDef);
      }
    }
  }

  // VisibleForTesting
  public generateFauxClassText(definition: SObjectDefinition): string {
    let declarations = Array.from(definition.fields);
    const className = definition.name;
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
        STDOUT_EVENT,
        nls.localize('fetched_sobjects_length_text', fetchedLength, sobjectKind)
      );
    }
  }

  private logFetchedObjects(
    standardSObjects: SObjectDefinition[],
    customSObjects: SObjectDefinition[]
  ) {
    this.logSObjects('Standard', standardSObjects.length);
    this.logSObjects('Custom', customSObjects.length);
  }
}
