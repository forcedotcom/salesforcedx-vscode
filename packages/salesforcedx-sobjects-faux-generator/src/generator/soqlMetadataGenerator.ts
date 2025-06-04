/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TOOLS, createDirectory, projectPaths, safeDelete, writeFile } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import { CUSTOMOBJECTS_DIR, SOQLMETADATA_DIR, STANDARDOBJECTS_DIR } from '../constants';
import { SObjectShortDescription, SObjectsStandardAndCustom } from '../describe/types';
import { nls } from '../messages';
import { SObject, SObjectCategory, SObjectGenerator, SObjectRefreshOutput } from '../types';

const BASE_FOLDER = [TOOLS, SOQLMETADATA_DIR];
const outputFolderPath = path.join(projectPaths.stateFolder(), ...BASE_FOLDER);

export class SOQLMetadataGenerator implements SObjectGenerator {
  public constructor(private category: SObjectCategory) {}

  public async generate(output: SObjectRefreshOutput): Promise<void> {
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

/** write the typeNames.json file */
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

export const generateAllMetadata = async (sobjects: SObjectsStandardAndCustom) => {
  await createDirectory(outputFolderPath);

  await Promise.all([
    ...Object.entries(sobjects)
      .filter(([_, objects]) => objects.length > 0)
      .map(async ([category, objects]) => {
        const objectFolder = path.join(
          outputFolderPath,
          category === 'standard' ? STANDARDOBJECTS_DIR : CUSTOMOBJECTS_DIR
        );
        await safeDelete(objectFolder, { recursive: true, useTrash: false });
        await createDirectory(objectFolder);
        return objects.map(o => generateMetadataForSObject(objectFolder, o));
      })
  ]);
};

export const writeTypeNamesFile = async (typeNames: SObjectShortDescription[]): Promise<void> => {
  await createDirectory(outputFolderPath);
  const typeNameFile = path.join(outputFolderPath, 'typeNames.json');
  await safeDelete(typeNameFile);
  await writeFile(typeNameFile, JSON.stringify(typeNames, null, 2));
};
