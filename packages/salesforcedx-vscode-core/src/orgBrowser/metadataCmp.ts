/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ListMetadataQuery } from '@jsforce/jsforce-node/lib/api/metadata';
import { Connection } from '@salesforce/core-bundle';
import { isNullOrUndefined, projectPaths, workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import { standardValueSet } from '@salesforce/source-deploy-retrieve-bundle/lib/src/registry';
import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceContext } from '../context';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';

const validManageableStates = new Set([
  'unmanaged',
  'installedEditable',
  'deprecatedEditable',
  undefined // not part of a package
]);

const STANDARDVALUESET_FULLNAME = 'StandardValueSet';

export const CUSTOMOBJECTS_FULLNAME = 'CustomObject';

export class ComponentUtils {
  public async getComponentsPath(metadataType: string, folderName?: string): Promise<string> {
    if (!workspaceUtils.hasRootWorkspace()) {
      const err = nls.localize('cannot_determine_workspace');
      telemetryService.sendException('metadata_cmp_workspace', err);
      throw new Error(err);
    }

    const fileName = `${folderName ? `${metadataType}_${folderName}` : metadataType}.json`;
    const componentsPath = path.join(await projectPaths.metadataFolder(), fileName);
    return componentsPath;
  }

  public buildComponentsList(metadataType: string, componentsFile?: string, componentsPath?: string): string[] {
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
          const { fullName, manageableState, namespacePrefix } = cmp;
          if (!isNullOrUndefined(fullName) && validManageableStates.has(manageableState)) {
            components.push(namespacePrefix ? `${namespacePrefix}__${fullName}` : fullName);
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

  public buildCustomObjectFieldsList(result?: string, componentsPath?: string): string[] {
    if (isNullOrUndefined(result)) {
      result = fs.readFileSync(componentsPath!, 'utf8');
    }
    const jsonResult = JSON.parse(result);
    const fields = jsonResult.result.map(
      (field: { name: string; type: string; relationshipName?: string; length?: number }) => {
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
  }

  public async fetchAndSaveMetadataComponentProperties(
    metadataType: string,
    connection: Connection,
    componentsPath: string,
    folderName?: string
  ): Promise<string> {
    const metadataQuery: ListMetadataQuery = { type: metadataType };
    if (folderName) {
      metadataQuery.folder = folderName;
    }
    const metadataFileProperties = await connection.metadata.list(metadataQuery);
    const result = { status: 0, result: metadataFileProperties };
    const jsonResult = JSON.stringify(result, null, 2);
    fs.writeFileSync(componentsPath, jsonResult);
    return jsonResult;
  }

  public async fetchAndSaveSObjectFieldsProperties(
    connection: Connection,
    componentsPath: string,
    folderName: string
  ): Promise<string> {
    const describeSObjectFields = await connection.describe(folderName);
    const describeSObjectFieldsList = describeSObjectFields.fields;
    const result = { status: 0, result: describeSObjectFieldsList };
    const jsonResult = JSON.stringify(result, null, 2);
    fs.writeFileSync(componentsPath, jsonResult);
    return jsonResult;
  }

  // todo: remove defaultOrg (target org) arg
  public async loadComponents(
    defaultOrg: string,
    metadataType: string,
    folderName?: string,
    forceRefresh?: boolean
  ): Promise<string[]> {
    const componentsPath = await this.getComponentsPath(metadataType, folderName);
    let componentsList: string[];
    const freshFetch = forceRefresh || !fs.existsSync(componentsPath);
    const connection = await WorkspaceContext.getInstance().getConnection();
    if (metadataType === CUSTOMOBJECTS_FULLNAME && folderName) {
      if (freshFetch) {
        componentsList = await this.fetchCustomObjectsFields(connection, componentsPath, folderName);
      } else {
        componentsList = this.fetchExistingCustomObjectsFields(componentsPath);
      }
    } else if (metadataType === STANDARDVALUESET_FULLNAME) {
      componentsList = standardValueSet.fullnames;
    } else {
      if (freshFetch) {
        componentsList = await this.fetchMetadataComponents(metadataType, connection, componentsPath, folderName);
      } else {
        componentsList = this.fetchExistingMetadataComponents(metadataType, componentsPath);
      }
    }
    return componentsList;
  }

  /**
   * Retrieves a list of all fields of the standard or custom object.
   * @param connection instance of Connection
   * @param componentsPath json file path of the component
   * @param folderName name of the custom or standard object listed under Custom Objects
   * @returns list of name of fields of the standard or custom object
   */
  public async fetchCustomObjectsFields(connection: Connection, componentsPath: string, folderName: string) {
    const result = await this.fetchAndSaveSObjectFieldsProperties(connection, componentsPath, folderName);
    const fieldList = this.buildCustomObjectFieldsList(result, componentsPath);

    return fieldList;
  }

  /**
   * Builds list of components from existing json file at the componentsPath
   * @param metadataType name of metadata type
   * @param componentsPath existing json file path of the component
   * @returns list of name of metadata components
   */
  public fetchExistingMetadataComponents(metadataType: string, componentsPath: string) {
    return this.buildComponentsList(metadataType, undefined, componentsPath);
  }

  /**
   * Retrieves a list of metadata components
   * @param metadataType name of metadata component
   * @param connection instance of connection
   * @param componentsPath json file path of the component
   * @param folderName name of the folders listed under metadata components like Email Templates, Documents, Dashboards or Reports
   * @returns a list of name of metadata components
   */
  public async fetchMetadataComponents(
    metadataType: string,
    connection: Connection,
    componentsPath: string,
    folderName: string | undefined
  ) {
    const result = await this.fetchAndSaveMetadataComponentProperties(
      metadataType,
      connection,
      componentsPath,
      folderName
    );
    const componentList = this.buildComponentsList(metadataType, result, undefined);
    return componentList;
  }

  /**
   * Builds a list of all fields of the standard or custom object from existing json file at the componentsPath
   * @param componentsPath existing json file path of the component
   * @returns a list of all fields of the standard or custom object
   */
  public fetchExistingCustomObjectsFields(componentsPath: string) {
    return this.buildCustomObjectFieldsList(undefined, componentsPath);
  }
}
