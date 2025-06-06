/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TOOLS, createDirectory, safeDelete, writeFile } from '@salesforce/salesforcedx-utils-vscode';
import { EOL } from 'node:os';
import * as path from 'node:path';
import { SOBJECTS_DIR } from '../constants';
import { nls } from '../messages';
import { FieldDeclaration, SObjectCategory, SObjectDefinition, SObjectGenerator, SObjectRefreshOutput } from '../types';
import { DeclarationGenerator, MODIFIER } from './declarationGenerator';

export const INDENT = '    ';
const APEX_CLASS_EXTENSION = '.cls';
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

  public async generate(output: SObjectRefreshOutput): Promise<void> {
    const outputFolderPath = path.join(output.sfdxPath, ...REL_BASE_FOLDER, this.relativePath);
    if (!(await this.resetOutputFolder(outputFolderPath))) {
      throw nls.localize('no_sobject_output_folder_text', outputFolderPath);
    }

    const sobjects = this.sobjectSelector === SObjectCategory.STANDARD ? output.getStandard() : output.getCustom();

    for (const sobj of sobjects) {
      if (sobj.name) {
        const sobjDefinition = this.declGenerator.generateSObjectDefinition(sobj);
        await this.generateFauxClass(outputFolderPath, sobjDefinition);
      }
    }
  }

  // VisibleForTesting
  public async generateFauxClass(folderPath: string, definition: SObjectDefinition): Promise<string> {
    await createDirectory(folderPath);
    const fauxClassPath = path.join(folderPath, `${definition.name}${APEX_CLASS_EXTENSION}`);
    await writeFile(fauxClassPath, this.generateFauxClassText(definition));
    return fauxClassPath;
  }

  // VisibleForTesting
  public generateFauxClassText(definition: SObjectDefinition): string {
    let declarations = Array.from(definition.fields);
    const className = definition.name;
    // sort, but filter out duplicates
    // which can happen due to childRelationships w/o a relationshipName
    declarations.sort((first, second): number => (first.name || first.type > second.name || second.type ? 1 : -1));

    declarations = declarations.filter(
      (value, index, array): boolean => !index || value.name !== array[index - 1].name
    );

    const classDeclaration = `${MODIFIER} class ${className} {${EOL}`;
    const declarationLines = declarations.map(FauxClassGenerator.fieldDeclToString).join(`${EOL}`);
    const classConstructor = `${INDENT}${MODIFIER} ${className} () ${EOL}    {${EOL}    }${EOL}`;

    const generatedClass = `${nls.localize(
      'class_header_generated_comment'
    )}${classDeclaration}${declarationLines}${EOL}${EOL}${classConstructor}}`;

    return generatedClass;
  }

  private async resetOutputFolder(pathToClean: string): Promise<boolean> {
    try {
      await safeDelete(pathToClean, { recursive: true, useTrash: false });
      await createDirectory(pathToClean);
      return true;
    } catch (error) {
      throw new Error(`Failed to reset output folder: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
