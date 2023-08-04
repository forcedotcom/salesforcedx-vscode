/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TOOLS } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { mkdir, rm } from 'shelljs';
import {
  CUSTOMOBJECTS_DIR,
  SOQLMETADATA_DIR,
  STANDARDOBJECTS_DIR
} from '../constants';
import { SObjectShortDescription } from '../describe';
import { nls } from '../messages';
import {
  SObject,
  SObjectCategory,
  SObjectGenerator,
  SObjectRefreshOutput
} from '../types';
import { exists } from '../utils/fsUtils';

const BASE_FOLDER = [TOOLS, SOQLMETADATA_DIR];

export class SOQLMetadataGenerator implements SObjectGenerator {
  public constructor(private category: SObjectCategory) {}

  public async generate(output: SObjectRefreshOutput): Promise<void> {
    const outputFolderPath = path.join(output.sfdxPath, ...BASE_FOLDER);
    if (!this.resetOutputFolder(outputFolderPath, this.category)) {
      throw nls.localize('no_sobject_output_folder_text', outputFolderPath);
    }

    await this.generateTypesNames(outputFolderPath, output.getTypeNames());

    await Promise.all(
      [...output.getStandard(), ...output.getCustom()]
        .filter(sobject => sobject.name)
        .map(sobject =>
          this.generateMetadataForSObject(outputFolderPath, sobject)
        )
    );
  }

  private async generateTypesNames(
    folderPath: string,
    typeNames: SObjectShortDescription[]
  ): Promise<void> {
    await fs.mkdir(folderPath, { recursive: true });
    const typeNameFile = path.join(folderPath, 'typeNames.json');
    if (await exists(typeNameFile)) {
      await fs.unlink(typeNameFile);
    }
    await fs.writeFile(typeNameFile, JSON.stringify(typeNames, null, 2), {
      mode: 0o444
    });
  }

  private async generateMetadataForSObject(
    folderPath: string,
    sobject: SObject
  ): Promise<void> {
    if (!(await exists(folderPath))) {
      await fs.mkdir(folderPath, { recursive: true });
    }
    const targetPath = path.join(
      folderPath,
      sobject.custom ? CUSTOMOBJECTS_DIR : STANDARDOBJECTS_DIR,
      `${sobject.name}.json`
    );

    await fs.writeFile(targetPath, JSON.stringify(sobject, null, 2), {
      mode: 0o444
    });
  }

  private async resetOutputFolder(
    outputFolder: string,
    category: SObjectCategory
  ): Promise<boolean> {
    const customsFolder = path.join(outputFolder, CUSTOMOBJECTS_DIR);
    const standardsFolder = path.join(outputFolder, STANDARDOBJECTS_DIR);

    if (
      [
        SObjectCategory.ALL,
        SObjectCategory.STANDARD,
        SObjectCategory.PROJECT
      ].includes(category)
    ) {
      await fs.rm(standardsFolder, { recursive: true, force: true });
    }
    if (
      [
        SObjectCategory.ALL,
        SObjectCategory.CUSTOM,
        SObjectCategory.PROJECT
      ].includes(category)
    ) {
      await fs.rm(customsFolder, { recursive: true, force: true });
    }

    await fs.mkdir(customsFolder, { recursive: true });
    await fs.mkdir(standardsFolder, { recursive: true });
    return true;
  }
}
