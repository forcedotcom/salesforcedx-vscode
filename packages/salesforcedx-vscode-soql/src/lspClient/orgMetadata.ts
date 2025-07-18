/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CUSTOMOBJECTS_DIR,
  type SObject,
  type SObjectField,
  SOQLMETADATA_DIR,
  STANDARDOBJECTS_DIR,
  toMinimalSObject
} from '@salesforce/salesforcedx-sobjects-faux-generator';
import { projectPaths, readDirectory, readFile } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import { nls } from '../messages';
import { channelService, retrieveSObject, retrieveSObjects } from '../sf';

export { SObject, SObjectField };

export type OrgDataSource = {
  retrieveSObjectsList(): Promise<string[]>;
  retrieveSObject(sobjectName: string): Promise<SObject | undefined>;
};

export class FileSystemOrgDataSource implements OrgDataSource {
  private getLocalDatapath(): string | undefined {
    const stateFolder = projectPaths.stateFolder();
    if (!stateFolder) {
      const message = nls.localize('error_no_workspace_folder');
      channelService.appendLine(message);
      return undefined;
    }
    return path.join(projectPaths.toolsFolder(), SOQLMETADATA_DIR);
  }

  public async retrieveSObjectsList(): Promise<string[]> {
    const soqlMetadataPath = this.getLocalDatapath();
    if (!soqlMetadataPath) {
      return [];
    }

    const customsFolder = path.join(soqlMetadataPath, CUSTOMOBJECTS_DIR);
    const standardsFolder = path.join(soqlMetadataPath, STANDARDOBJECTS_DIR);

    const files: string[] = [];
    try {
      const standardsDir = await readDirectory(standardsFolder);
      files.push(...standardsDir.map(entry => entry[0]));
    } catch {
      // Standards folder doesn't exist or can't be read
    }

    try {
      const customsDir = await readDirectory(customsFolder);
      files.push(...customsDir.map(entry => entry[0]));
    } catch {
      // Customs folder doesn't exist or can't be read
    }

    if (files.length === 0) {
      const message = nls.localize('error_sobjects_fs_request', soqlMetadataPath);
      channelService.appendLine(message);
    }

    return files.filter(fileName => fileName.endsWith('.json')).map(fileName => fileName.replace(/.json$/, ''));
  }

  public async retrieveSObject(sobjectName: string): Promise<SObject | undefined> {
    const soqlMetadataPath = this.getLocalDatapath();
    if (!soqlMetadataPath) {
      return undefined;
    }

    const filePath = path.join(soqlMetadataPath, STANDARDOBJECTS_DIR, `${sobjectName}.json`);
    try {
      const fileContent = await readFile(filePath);
      // TODO: validate content against a schema
      return JSON.parse(fileContent);
    } catch {
      const message = nls.localize(
        'error_sobject_metadata_fs_request',
        sobjectName,
        path.join(soqlMetadataPath, '*', `${sobjectName}.json`)
      );
      channelService.appendLine(message);
      return undefined;
    }
  }
}

export class JsforceOrgDataSource implements OrgDataSource {
  public async retrieveSObjectsList(): Promise<string[]> {
    try {
      return await retrieveSObjects();
    } catch {
      const message = nls.localize('error_sobjects_request');
      channelService.appendLine(message);
      return [];
    }
  }

  public async retrieveSObject(sobjectName: string): Promise<SObject | undefined> {
    try {
      return toMinimalSObject(await retrieveSObject(sobjectName));
    } catch {
      const message = nls.localize('error_sobject_metadata_request', sobjectName);
      channelService.appendLine(message);
      return undefined;
    }
  }
}
