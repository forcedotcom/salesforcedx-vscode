/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TOOLS } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
import * as path from 'path';
import { mkdir, rm } from 'shelljs';
import { CUSTOMOBJECTS_DIR, SOQLMETADATA_DIR, STANDARDOBJECTS_DIR } from '../constants';
import { SObjectShortDescription } from '../describe';
import { nls } from '../messages';
import { SObject, SObjectCategory, SObjectGenerator, SObjectRefreshOutput } from '../types';

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

  private generateTypesNames(folderPath: string, typeNames: SObjectShortDescription[]): void {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    const typeNameFile = path.join(folderPath, 'typeNames.json');
    if (fs.existsSync(typeNameFile)) {
      fs.unlinkSync(typeNameFile);
    }
    fs.writeFileSync(typeNameFile, JSON.stringify(typeNames, null, 2), {
      mode: 0o444
    });
  }

  private generateMetadataForSObject(folderPath: string, sobject: SObject): void {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }
    const targetPath = path.join(
      folderPath,
      sobject.custom ? CUSTOMOBJECTS_DIR : STANDARDOBJECTS_DIR,
      `${sobject.name}.json`
    );

    fs.writeFileSync(targetPath, JSON.stringify(sobject, null, 2), {
      mode: 0o444
    });
  }

  private async resetOutputFolder(outputFolder: string, category: SObjectCategory): Promise<boolean> {
    const customsFolder = path.join(outputFolder, CUSTOMOBJECTS_DIR);
    const standardsFolder = path.join(outputFolder, STANDARDOBJECTS_DIR);

    if ([SObjectCategory.ALL, SObjectCategory.STANDARD].includes(category) && fs.existsSync(standardsFolder)) {
      rm('-rf', standardsFolder);
    }
    if ([SObjectCategory.ALL, SObjectCategory.CUSTOM].includes(category) && fs.existsSync(customsFolder)) {
      rm('-rf', customsFolder);
    }

    if (!fs.existsSync(customsFolder)) {
      mkdir('-p', customsFolder);
    }
    if (!fs.existsSync(standardsFolder)) {
      mkdir('-p', standardsFolder);
    }
    return true;
  }
}
