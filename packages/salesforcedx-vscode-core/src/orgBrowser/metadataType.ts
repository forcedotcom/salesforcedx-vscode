/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  isNullOrUndefined,
  MISSING_LABEL_MSG,
  projectPaths,
  workspaceUtils,
  readFile,
  fileOrFolderExists
} from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import { describeMetadata } from '../commands';
import { coerceMessageKey, nls } from '../messages';
import { telemetryService } from '../telemetry';

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

  public getTypesFolder(): string {
    if (!workspaceUtils.hasRootWorkspace()) {
      const err = nls.localize('cannot_determine_workspace');
      telemetryService.sendException('metadata_type_workspace', err);
      throw new Error(err);
    }
    const metadataTypesPath = projectPaths.metadataFolder();
    return metadataTypesPath;
  }

  public async loadTypes(forceRefresh?: boolean): Promise<MetadataObject[]> {
    const typesFolder = this.getTypesFolder();
    const typesPath = path.join(typesFolder, 'metadataTypes.json');

    let typesList: MetadataObject[];
    if (forceRefresh || !(await fileOrFolderExists(typesPath))) {
      const result = await describeMetadata(typesFolder);
      typesList = await buildTypesList({ metadataJSONContents: result });
    } else {
      typesList = await buildTypesList({ metadataTypesPath: typesPath });
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

const buildTypesList = async (
  input: { metadataTypesPath: string } | { metadataJSONContents: string }
): Promise<MetadataObject[]> => {
  try {
    const jsonObject = JSON.parse(
      'metadataJSONContents' in input ? input.metadataJSONContents : await readFile(input.metadataTypesPath)
    );
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const metadataTypeObjects = (jsonObject.result.metadataObjects as MetadataObject[])
      .filter(type => !isNullOrUndefined(type.xmlName) && !TypeUtils.UNSUPPORTED_TYPES.has(type.xmlName))
      .map(mdTypeObject => ({
        ...mdTypeObject,
        label: nls.localize(coerceMessageKey(mdTypeObject.xmlName)).startsWith(MISSING_LABEL_MSG)
          ? mdTypeObject.xmlName
          : nls.localize(coerceMessageKey(mdTypeObject.xmlName))
      }))
      .sort((a, b) => (a.label > b.label ? 1 : -1));
    telemetryService.sendEventData('Metadata Types Quantity', undefined, {
      metadataTypes: metadataTypeObjects.length
    });

    return metadataTypeObjects;
  } catch (e) {
    telemetryService.sendException('metadata_type_build_types_list', e.message);
    throw new Error(e);
  }
};
