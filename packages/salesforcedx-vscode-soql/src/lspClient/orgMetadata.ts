/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DescribeSObjectResult, Field } from 'jsforce';

import { getRootWorkspaceSfdxPath } from '@salesforce/salesforcedx-utils-vscode/out/src';
import { retrieveSObject, retrieveSObjects, channelService } from '../sfdx';
import {
  SObject,
  SObjectField
} from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/types';
import {
  SObjectShortDescription,
  toMinimalSObject
} from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/describe';
import {
  TOOLS_DIR,
  SOQLMETADATA_DIR,
  CUSTOMOBJECTS_DIR,
  STANDARDOBJECTS_DIR
} from '@salesforce/salesforcedx-sobjects-faux-generator/out/src';
import { nls } from '../messages';
import * as fs from 'fs';
import * as path from 'path';

export { SObject, SObjectField };

export interface OrgDataSource {
  retrieveSObjectsList(): Promise<string[]>;
  retrieveSObject(sobjectName: string): Promise<SObject | undefined>;
}

export class FileSystemOrgDataSource implements OrgDataSource {
  private getLocalDatapath(): string | undefined {
    const sfdxPath = getRootWorkspaceSfdxPath();
    if (!sfdxPath) {
      const message = nls.localize('error_no_workspace_folder');
      channelService.appendLine(message);
      return undefined;
    }
    return path.join(sfdxPath, TOOLS_DIR, SOQLMETADATA_DIR);
  }

  public async retrieveSObjectsList(): Promise<string[]> {
    const soqlMetadataPath = this.getLocalDatapath();
    if (!soqlMetadataPath) {
      return [];
    }

    const customsFolder = path.join(soqlMetadataPath, CUSTOMOBJECTS_DIR);
    const standardsFolder = path.join(soqlMetadataPath, STANDARDOBJECTS_DIR);

    const files: string[] = [];
    if (fs.existsSync(standardsFolder)) {
      files.push(...(await fs.promises.readdir(standardsFolder)));
    }
    if (fs.existsSync(customsFolder)) {
      files.push(...(await fs.promises.readdir(customsFolder)));
    }

    if (files.length === 0) {
      const message = nls.localize(
        'error_sobjects_fs_request',
        soqlMetadataPath
      );
      channelService.appendLine(message);
    }

    return files
      .filter(fileName => fileName.endsWith('.json'))
      .map(fileName => fileName.replace(/.json$/, ''));
  }

  public async retrieveSObject(
    sobjectName: string
  ): Promise<SObject | undefined> {
    const soqlMetadataPath = this.getLocalDatapath();
    if (!soqlMetadataPath) {
      return undefined;
    }

    let filePath = path.join(
      soqlMetadataPath,
      STANDARDOBJECTS_DIR,
      sobjectName + '.json'
    );
    if (!fs.existsSync(filePath)) {
      filePath = path.join(
        soqlMetadataPath,
        CUSTOMOBJECTS_DIR,
        sobjectName + '.json'
      );
    }

    try {
      const file = await fs.promises.readFile(filePath);
      // TODO: validate content against a schema
      return JSON.parse(file.toString());
    } catch (e) {
      const message = nls.localize(
        'error_sobject_metadata_fs_request',
        sobjectName,
        path.join(soqlMetadataPath, '*', sobjectName + '.json')
      );
      channelService.appendLine(message);
      return undefined;
    }
  }

  private async readTypeDescriptions(
    soqlMetadataPath: string
  ): Promise<SObjectShortDescription[]> {
    const savedTypeNamesBuffer = await fs.promises.readFile(
      path.join(soqlMetadataPath, 'typeNames.json')
    );
    // TODO: validate content against a schema
    const savedTypeNames = JSON.parse(
      savedTypeNamesBuffer.toString()
    ) as SObjectShortDescription[];

    return savedTypeNames;
  }
}

export class JsforceOrgDataSource implements OrgDataSource {
  async retrieveSObjectsList(): Promise<string[]> {
    try {
      return await retrieveSObjects();
    } catch (metadataError) {
      const message = nls.localize('error_sobjects_request');
      channelService.appendLine(message);
      return [];
    }
  }

  async retrieveSObject(sobjectName: string): Promise<SObject | undefined> {
    try {
      return toMinimalSObject(await retrieveSObject(sobjectName));
    } catch (metadataError) {
      const message = nls.localize(
        'error_sobject_metadata_request',
        sobjectName
      );
      channelService.appendLine(message);
      return undefined;
    }
  }
}
