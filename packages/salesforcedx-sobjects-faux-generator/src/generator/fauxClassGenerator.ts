/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import { EOL } from 'os';
import * as path from 'path';
import { mkdir, rm } from 'shelljs';
import { SOBJECTS_DIR, TOOLS_DIR } from '../constants';
import { nls } from '../messages';
import {
  SObjectCategory,
  SObjectGenerator,
  SObjectRefreshOutput
} from '../types';
import { MODIFIER } from './declarationGenerator';
import { FieldDeclaration, SObjectDefinition } from './types';

export const INDENT = '    ';
export const APEX_CLASS_EXTENSION = '.cls';
const REL_BASE_FOLDER = [TOOLS_DIR, SOBJECTS_DIR];

export class FauxClassGenerator implements SObjectGenerator {
  private definitionSelector: SObjectCategory;
  private relativePath: string;

  public constructor(
    definitionSelector: SObjectCategory,
    relativePath: string
  ) {
    this.definitionSelector = definitionSelector;
    this.relativePath = relativePath;

    if (
      definitionSelector !== SObjectCategory.STANDARD &&
      definitionSelector !== SObjectCategory.CUSTOM
    ) {
      // TODO need I18N
      throw new Error('Unsupported sobject category');
    }
  }

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

  public generate(output: SObjectRefreshOutput): void {
    // const baseFolderPath = path.join(output.sfdxPath, ...REL_BASE_FOLDER);
    const outputFolderPath = path.join(
      output.sfdxPath,
      ...REL_BASE_FOLDER,
      this.relativePath
    );
    if (!this.resetOutputFolder(outputFolderPath)) {
      throw nls.localize('no_sobject_output_folder_text', outputFolderPath);
    }

    const definitions =
      this.definitionSelector === SObjectCategory.STANDARD
        ? output.getStandard()
        : output.getCustom();

    for (const objDef of definitions) {
      if (objDef.name) {
        this.generateFauxClass(outputFolderPath, objDef);
      }
    }
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
