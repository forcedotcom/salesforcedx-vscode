/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createDirectory, projectPaths, safeDelete, writeFile } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import { CUSTOMOBJECTS_DIR, SOQLMETADATA_DIR, STANDARDOBJECTS_DIR } from '../constants';
import { SObjectShortDescription, SObjectsStandardAndCustom } from '../describe/types';

const outputFolderPath = path.join(projectPaths.toolsFolder(), SOQLMETADATA_DIR);

/** writes custom and standard objects in the json format used by SOQL extension */
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
        return objects.map(o => writeFile(path.join(objectFolder, `${o.name}.json`), JSON.stringify(o, null, 2)));
      })
  ]);
};

/** writes the typeNames.json file for SOQL*/
export const writeTypeNamesFile = async (typeNames: SObjectShortDescription[]): Promise<void> => {
  await createDirectory(outputFolderPath);
  const typeNameFile = path.join(outputFolderPath, 'typeNames.json');
  await safeDelete(typeNameFile);
  await writeFile(typeNameFile, JSON.stringify(typeNames, null, 2));
};
