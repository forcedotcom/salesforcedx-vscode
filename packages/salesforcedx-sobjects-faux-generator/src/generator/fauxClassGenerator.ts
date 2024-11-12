/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TOOLS } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
import { EOL } from 'os';
import * as path from 'path';
import { mkdir, rm } from 'shelljs';
import { SOBJECTS_DIR } from '../constants';
import { nls } from '../messages';
import { FieldDeclaration, SObjectCategory, SObjectDefinition, SObjectGenerator, SObjectRefreshOutput } from '../types';
import { DeclarationGenerator, MODIFIER } from './declarationGenerator';

export const INDENT = '    ';
export const APEX_CLASS_EXTENSION = '.cls';
const REL_BASE_FOLDER = [TOOLS, SOBJECTS_DIR];

export class FauxClassGenerator implements SObjectGenerator {
  private sobjectSelector: SObjectCategory;
  private relativePath: string;
  private declGenerator: DeclarationGenerator;

  public constructor(selector: SObjectCategory, relativePath: string) {
    this.sobjectSelector = selector;
    this.relativePath = relativePath;
    this.declGenerator = new DeclarationGenerator();

    if (selector !== SObjectCategory.STANDARD && selector !== SObjectCategory.CUSTOM) {
      throw nls.localize('unsupported_sobject_category', String(selector));
    }
  }

  private static fieldDeclToString(decl: FieldDeclaration): string {
    return `${FauxClassGenerator.commentToString(decl.comment)}${INDENT}${decl.modifier} ${decl.type} ${decl.name};`;
  }

  // VisibleForTesting
  public static commentToString(comment?: string): string {
    // for some reasons if the comment is on a single line the help context shows the last '*/'
    return comment ? `${INDENT}/* ${comment.replace(/(\/\*+\/)|(\/\*+)|(\*+\/)/g, '')}${EOL}${INDENT}*/${EOL}` : '';
  }

  public generate(output: SObjectRefreshOutput): void {
    const outputFolderPath = path.join(output.sfdxPath, ...REL_BASE_FOLDER, this.relativePath);
    if (!this.resetOutputFolder(outputFolderPath)) {
      throw nls.localize('no_sobject_output_folder_text', outputFolderPath);
    }

    const sobjects = this.sobjectSelector === SObjectCategory.STANDARD ? output.getStandard() : output.getCustom();

    for (const sobj of sobjects) {
      if (sobj.name) {
        const sobjDefinition = this.declGenerator.generateSObjectDefinition(sobj);
        this.generateFauxClass(outputFolderPath, sobjDefinition);
      }
    }
  }

  // VisibleForTesting
  public generateFauxClass(folderPath: string, definition: SObjectDefinition): string {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }
    const fauxClassPath = path.join(folderPath, `${definition.name}${APEX_CLASS_EXTENSION}`);
    fs.writeFileSync(fauxClassPath, this.generateFauxClassText(definition), {
      mode: 0o444
    });
    return fauxClassPath;
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
    const declarationLines = declarations.map(FauxClassGenerator.fieldDeclToString).join(`${EOL}`);
    const classConstructor = `${INDENT}${MODIFIER} ${className} () ${EOL}    {${EOL}    }${EOL}`;

    const generatedClass = `${nls.localize(
      'class_header_generated_comment'
    )}${classDeclaration}${declarationLines}${EOL}${EOL}${classConstructor}}`;

    return generatedClass;
  }

  private resetOutputFolder(pathToClean: string): boolean {
    if (fs.existsSync(pathToClean)) {
      rm('-rf', pathToClean);
    }
    if (!fs.existsSync(pathToClean)) {
      mkdir('-p', pathToClean);
      return fs.existsSync(pathToClean);
    }
    return true;
  }
}
