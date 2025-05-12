/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TOOLS } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import { CUSTOMOBJECTS_DIR, SOQLMETADATA_DIR, STANDARDOBJECTS_DIR } from '../constants';
import { SObjectShortDescription } from '../describe';
import { nls } from '../messages';
import { SObject, SObjectCategory, SObjectGenerator, SObjectRefreshOutput } from '../types';
import { createDirectory, deleteFile, folderExists, writeFile } from '../utils';

const BASE_FOLDER = [TOOLS, SOQLMETADATA_DIR];

export class SOQLMetadataGenerator implements SObjectGenerator {
  public constructor(private category: SObjectCategory) {}

  public generate(output: SObjectRefreshOutput): void {
    const outputFolderPath = path.join(output.sfdxPath, ...BASE_FOLDER);
    if (!this.resetOutputFolder(outputFolderPath, this.category)) {
      throw nls.localize('no_sobject_output_folder_text', outputFolderPath);
    }

    this.generateTypesNames(outputFolderPath, output.getTypeNames());

    const sobjects = [...output.getStandard(), ...output.getCustom()];

    for (const sobj of sobjects) {
      if (sobj.name) {
        this.generateMetadataForSObject(outputFolderPath, sobj);
      }
    }
  }

  private async generateTypesNames(folderPath: string, typeNames: SObjectShortDescription[]): Promise<void> {
    if (!(await folderExists(folderPath))) {
      await createDirectory(folderPath);
    }
    const typeNameFile = path.join(folderPath, 'typeNames.json');
    if (await folderExists(typeNameFile)) {
      await deleteFile(typeNameFile);
    }
    await writeFile(typeNameFile, JSON.stringify(typeNames, null, 2));
  }

  private generateMetadataForSObject(folderPath: string, sobject: SObject): void {
    folderExists(folderPath).then(exists => {
      if (!exists) {
        createDirectory(folderPath);
      }
      const targetPath = path.join(
        folderPath,
        sobject.custom ? CUSTOMOBJECTS_DIR : STANDARDOBJECTS_DIR,
        `${sobject.name}.json`
      );
      writeFile(targetPath, JSON.stringify(sobject, null, 2));
    });
  }

  private async resetOutputFolder(outputFolder: string, category: SObjectCategory): Promise<boolean> {
    const customsFolder = path.join(outputFolder, CUSTOMOBJECTS_DIR);
    const standardsFolder = path.join(outputFolder, STANDARDOBJECTS_DIR);

    if ([SObjectCategory.ALL, SObjectCategory.STANDARD].includes(category) && (await folderExists(standardsFolder))) {
      await deleteFile(standardsFolder, { recursive: true, useTrash: false });
    }
    if ([SObjectCategory.ALL, SObjectCategory.CUSTOM].includes(category) && (await folderExists(customsFolder))) {
      await deleteFile(customsFolder, { recursive: true, useTrash: false });
    }

    await Promise.all([customsFolder, standardsFolder].map(folder => createDirectory(folder)));

    return true;
  }
}
