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
import { describeMetadata, DescribeMetadataResult } from '../commands/describeMetadata';
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
    return projectPaths.metadataFolder();
  }

  public async loadTypes(forceRefresh?: boolean): Promise<MetadataObject[]> {
    const typesFolder = this.getTypesFolder();
    const typesPath = path.join(typesFolder, 'metadataTypes.json');

    const describeResult =
      forceRefresh || !(await fileOrFolderExists(typesPath))
        ? await describeMetadata(typesFolder)
        : // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          (JSON.parse(await readFile(typesPath)) as DescribeMetadataResult);
    return buildTypesList(describeResult);
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

const buildTypesList = (describeResult: DescribeMetadataResult): MetadataObject[] => {
  try {
    const metadataTypeObjects = describeResult.result.metadataObjects
      .filter(type => !isNullOrUndefined(type.xmlName) && !TypeUtils.UNSUPPORTED_TYPES.has(type.xmlName))
      .map(mdTypeObject => ({
        ...mdTypeObject,
        label: nls.localize(coerceMessageKey(mdTypeObject.xmlName)).startsWith(MISSING_LABEL_MSG)
          ? mdTypeObject.xmlName
          : nls.localize(coerceMessageKey(mdTypeObject.xmlName)),
        suffix: mdTypeObject.suffix ?? undefined
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
