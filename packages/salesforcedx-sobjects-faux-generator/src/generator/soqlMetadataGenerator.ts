/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TOOLS, createDirectory, safeDelete, writeFile } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import { CUSTOMOBJECTS_DIR, SOQLMETADATA_DIR, STANDARDOBJECTS_DIR } from '../constants';
import { SObjectShortDescription } from '../describe';
import { nls } from '../messages';
import { SObject, SObjectCategory, SObjectGenerator, SObjectRefreshOutput } from '../types';

const BASE_FOLDER = [TOOLS, SOQLMETADATA_DIR];

export class SOQLMetadataGenerator implements SObjectGenerator {
  public constructor(private category: SObjectCategory) {}

  public async generate(output: SObjectRefreshOutput): Promise<void> {
    const outputFolderPath = path.join(output.sfdxPath, ...BASE_FOLDER);
    if (!(await this.resetOutputFolder(outputFolderPath, this.category))) {
      throw nls.localize('no_sobject_output_folder_text', outputFolderPath);
    }

    await generateTypesNames(outputFolderPath, output.getTypeNames());

    await Promise.all(
      [...output.getStandard(), ...output.getCustom()]
        .filter(o => o.name)
        .map(o => generateMetadataForSObject(outputFolderPath, o))
    );
  }

  private async resetOutputFolder(outputFolder: string, category: SObjectCategory): Promise<boolean> {
    const customsFolder = path.join(outputFolder, CUSTOMOBJECTS_DIR);
    const standardsFolder = path.join(outputFolder, STANDARDOBJECTS_DIR);

    if (['ALL', 'STANDARD'].includes(category)) {
      await safeDelete(standardsFolder, { recursive: true, useTrash: false });
    }
    if (['ALL', 'CUSTOM'].includes(category)) {
      await safeDelete(customsFolder, { recursive: true, useTrash: false });
    }

    await Promise.all([customsFolder, standardsFolder].map(folder => createDirectory(folder)));

    return true;
  }
}

// Non-exported helpers
const generateTypesNames = async (folderPath: string, typeNames: SObjectShortDescription[]): Promise<void> => {
  await createDirectory(folderPath);
  const typeNameFile = path.join(folderPath, 'typeNames.json');
  await safeDelete(typeNameFile);
  await writeFile(typeNameFile, JSON.stringify(typeNames, null, 2));
};

const generateMetadataForSObject = async (folderPath: string, sobject: SObject): Promise<void> => {
  await createDirectory(folderPath);
  const targetPath = path.join(
    folderPath,
    sobject.custom ? CUSTOMOBJECTS_DIR : STANDARDOBJECTS_DIR,
    `${sobject.name}.json`
  );
  await writeFile(targetPath, JSON.stringify(sobject, null, 2));
};
