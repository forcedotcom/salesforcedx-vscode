/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core';
import { isNullOrUndefined } from '@salesforce/salesforcedx-utils-vscode/out/src/helpers';
import * as fs from 'fs';
import * as path from 'path';
import { workspaceContext } from '../context';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath, hasRootWorkspace, OrgAuthInfo } from '../util';

const validManageableStates = new Set([
  'unmanaged',
  'installedEditable',
  'deprecatedEditable',
  undefined // not part of a package
]);

export class ComponentUtils {
  public async getComponentsPath(
    metadataType: string,
    defaultUsernameOrAlias: string,
    folder?: string
  ): Promise<string> {
    if (!hasRootWorkspace()) {
      const err = nls.localize('cannot_determine_workspace');
      telemetryService.sendException('metadata_cmp_workspace', err);
      throw new Error(err);
    }

    const username = await OrgAuthInfo.getUsername(defaultUsernameOrAlias);
    const fileName = `${
      folder ? `${metadataType}_${folder}` : metadataType
    }.json`;
    const componentsPath = path.join(
      getRootWorkspacePath(),
      '.sfdx',
      'orgs',
      username,
      'metadata',
      fileName
    );
    return componentsPath;
  }

  public buildComponentsList(
    metadataType: string,
    componentsFile?: string,
    componentsPath?: string
  ): string[] {
    try {
      if (isNullOrUndefined(componentsFile)) {
        componentsFile = fs.readFileSync(componentsPath!, 'utf8');
      }

      const jsonObject = JSON.parse(componentsFile);
      let cmpArray = jsonObject.result;

      const components = [];
      if (!isNullOrUndefined(cmpArray)) {
        cmpArray = cmpArray instanceof Array ? cmpArray : [cmpArray];
        for (const cmp of cmpArray) {
          const { fullName, manageableState } = cmp;
          if (
            !isNullOrUndefined(fullName) &&
            validManageableStates.has(manageableState)
          ) {
            components.push(fullName);
          }
        }
      }
      telemetryService.sendEventData(
        'Metadata Components quantity',
        { metadataType },
        { metadataComponents: components.length }
      );
      return components.sort();
    } catch (e) {
      telemetryService.sendException('metadata_cmp_build_cmp_list', e.message);
      throw new Error(e);
    }
  }

  public buildCustomObjectFieldsList(
    result?: string,
    componentsPath?: string
  ): string[] {
    try {
      if (isNullOrUndefined(result)) {
        result = fs.readFileSync(componentsPath!, 'utf8');
      }
      const jsonResult = JSON.parse(result);
      const fields = jsonResult.result.map(
      (field: {
        name: string;
        type: string;
        relationshipName?: string;
        length?: number;
      }) => {
        switch (field.type) {
          case 'string':
          case 'textarea':
          case 'email':
            return `${field.name} (${field.type}(${field.length}))`;
          case 'reference':
            return `${field.relationshipName} (reference)`;
          default:
            return `${field.name} (${field.type})`;
        }
      }
    );

      return fields;
    }catch (e) {
      telemetryService.sendException('metadata_cmp_build_cmp_list', e.message);
      throw new Error(e);
    }
  }

  public async listMetadataTypes(
    metadataType: string,
    connection: Connection,
    componentsPath: string
  ): Promise<string> {
    const metadataQuery = {type: metadataType};
    const metadataFileProperties = await connection.metadata.list(metadataQuery);
    const result = {status: 0, result: metadataFileProperties};
    const jsonResult = JSON.stringify(result);
    fs.writeFileSync(componentsPath, jsonResult);
    return jsonResult;
  }

  public async listSObjectFields(
    sObjectName: string,
    connection: Connection,
    componentsPath: string
  ): Promise<string> {
    const describeSObjectFields = await connection.describe(sObjectName);
    const describeSObjectFieldsList = describeSObjectFields.fields;
    const result = {status: 0, result: describeSObjectFieldsList};
    const jsonResult = JSON.stringify(result);
    fs.writeFileSync(componentsPath, jsonResult);
    return jsonResult;
  }

  public async loadComponents(
    defaultOrg: string,
    metadataType: string,
    folder?: string,
    forceRefresh?: boolean
  ): Promise<string[]> {
    const componentsPath = await this.getComponentsPath(
      metadataType,
      defaultOrg,
      folder
    );

    let componentsList: string[];

    const connection = await workspaceContext.getConnection();

    if (metadataType === 'CustomObject' && folder) {
      if (forceRefresh || !fs.existsSync(componentsPath)) {
        const result = await this.listSObjectFields(
          folder,
          connection,
          componentsPath
        );
        componentsList = this.buildCustomObjectFieldsList(
          result,
          componentsPath
        );
      } else {
        componentsList = this.buildCustomObjectFieldsList(
          undefined,
          componentsPath
        );
      }

    } else if (forceRefresh || !fs.existsSync(componentsPath)) {
      const result = await this.listMetadataTypes(
        metadataType,
        connection,
        componentsPath
      );

      componentsList = this.buildComponentsList(
        metadataType,
        result,
        undefined
      );
    } else {
      componentsList = this.buildComponentsList(
        metadataType,
        undefined,
        componentsPath
      );
    }
    return componentsList;
  }
}
