/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isNullOrUndefined, MISSING_LABEL_MSG, projectPaths } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
import * as path from 'path';
import { describeMetadata } from '../commands';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';
import { workspaceUtils } from '../util';

export type MetadataObject = {
  directoryName: string;
  inFolder: boolean;
  metaFile: boolean;
  suffix?: string;
  xmlName: string;
  label: string;
};
export class TypeUtils {
  public static readonly FOLDER_TYPES = new Set(['CustomObject', 'Dashboard', 'Document', 'EmailTemplate', 'Report']);

  public static readonly UNSUPPORTED_TYPES = new Set(['InstalledPackage', 'Profile', 'Scontrol']);

  public async getTypesFolder(): Promise<string> {
    if (!workspaceUtils.hasRootWorkspace()) {
      const err = nls.localize('cannot_determine_workspace');
      telemetryService.sendException('metadata_type_workspace', err);
      throw new Error(err);
    }
    const metadataTypesPath = projectPaths.metadataFolder();
    return metadataTypesPath;
  }

  public buildTypesList(metadataFile?: any, metadataTypesPath?: string): MetadataObject[] {
    try {
      if (isNullOrUndefined(metadataFile)) {
        metadataFile = fs.readFileSync(metadataTypesPath!, 'utf8');
      }
      const jsonObject = JSON.parse(metadataFile);
      let metadataTypeObjects = jsonObject.result.metadataObjects as MetadataObject[];
      metadataTypeObjects = metadataTypeObjects.filter(
        type => !isNullOrUndefined(type.xmlName) && !TypeUtils.UNSUPPORTED_TYPES.has(type.xmlName)
      );

      telemetryService.sendEventData('Metadata Types Quantity', undefined, {
        metadataTypes: metadataTypeObjects.length
      });

      for (const mdTypeObject of metadataTypeObjects) {
        mdTypeObject.label = nls.localize(mdTypeObject.xmlName).startsWith(MISSING_LABEL_MSG)
          ? mdTypeObject.xmlName
          : nls.localize(mdTypeObject.xmlName);
      }

      return metadataTypeObjects.sort((a, b) => (a.label > b.label ? 1 : -1));
    } catch (e) {
      telemetryService.sendException('metadata_type_build_types_list', e.message);
      throw new Error(e);
    }
  }

  public async loadTypes(forceRefresh?: boolean): Promise<MetadataObject[]> {
    const typesFolder = await this.getTypesFolder();
    const typesPath = path.join(typesFolder, 'metadataTypes.json');

    let typesList: MetadataObject[];
    if (forceRefresh || !fs.existsSync(typesPath)) {
      const result = await describeMetadata(typesFolder);
      typesList = this.buildTypesList(result, undefined);
    } else {
      typesList = this.buildTypesList(undefined, typesPath);
    }
    return typesList;
  }

  public getFolderForType(metadataType: string): string {
    switch (metadataType) {
      case 'CustomObject':
        return metadataType;
      case 'EmailTemplate':
        return 'EmailFolder';
      default:
        return `${metadataType}Folder`;
    }
  }
}
