/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { xhr, XHROptions, XHRResponse } from 'request-light';

export interface SObject {
  actionOverrides: any[];
  activateable: boolean;
  childRelationships: ChildRelationship[];
  compactLayoutable: boolean;
  createable: boolean;
  custom: boolean;
  customSetting: boolean;
  deletable: boolean;
  deprecatedAndHidden: boolean;
  feedEnabled: boolean;
  fields: Field[];
  hasSubtypes: boolean;
  isSubtype: boolean;
  keyPrefix: string;
  label: string;
  labelPlural: string;
  layoutable: boolean;
  listviewable?: any;
  lookupLayoutable?: any;
  mergeable: boolean;
  mruEnabled: boolean;
  name: string;
  namedLayoutInfos: any[];
  networkScopeFieldName?: any;
  queryable: boolean;
  recordTypeInfos: RecordTypeInfo[];
  replicateable: boolean;
  retrieveable: boolean;
  searchLayoutable: boolean;
  searchable: boolean;
  supportedScopes: SupportedScope[];
  triggerable: boolean;
  undeletable: boolean;
  updateable: boolean;
  urls: Urls2;
}

export interface ChildRelationship {
  cascadeDelete: boolean;
  childSObject: string;
  deprecatedAndHidden: boolean;
  field: string;
  junctionIdListNames: any[];
  junctionReferenceTo: any[];
  relationshipName: string;
  restrictedDelete: boolean;
}

export interface Field {
  aggregatable: boolean;
  autoNumber: boolean;
  byteLength: number;
  calculated: boolean;
  calculatedFormula?: any;
  cascadeDelete: boolean;
  caseSensitive: boolean;
  compoundFieldName?: any;
  controllerName?: any;
  createable: boolean;
  custom: boolean;
  defaultValue?: boolean;
  defaultValueFormula?: any;
  defaultedOnCreate: boolean;
  dependentPicklist: boolean;
  deprecatedAndHidden: boolean;
  digits: number;
  displayLocationInDecimal: boolean;
  encrypted: boolean;
  externalId: boolean;
  extraTypeInfo?: any;
  filterable: boolean;
  filteredLookupInfo?: any;
  groupable: boolean;
  highScaleNumber: boolean;
  htmlFormatted: boolean;
  idLookup: boolean;
  inlineHelpText?: any;
  label: string;
  length: number;
  mask?: any;
  maskType?: any;
  name: string;
  nameField: boolean;
  namePointing: boolean;
  nillable: boolean;
  permissionable: boolean;
  picklistValues: any[];
  polymorphicForeignKey: boolean;
  precision: number;
  queryByDistance: boolean;
  referenceTargetField?: any;
  referenceTo: string[];
  relationshipName: string;
  relationshipOrder?: any;
  restrictedDelete: boolean;
  restrictedPicklist: boolean;
  scale: number;
  searchPrefilterable: boolean;
  soapType: string;
  sortable: boolean;
  type: string;
  unique: boolean;
  updateable: boolean;
  writeRequiresMasterRead: boolean;
}

export interface Urls {
  layout: string;
}

export interface RecordTypeInfo {
  active: boolean;
  available: boolean;
  defaultRecordTypeMapping: boolean;
  master: boolean;
  name: string;
  recordTypeId: string;
  urls: Urls;
}

export interface SupportedScope {
  label: string;
  name: string;
}

export interface Urls2 {
  compactLayouts: string;
  rowTemplate: string;
  approvalLayouts: string;
  uiDetailTemplate: string;
  uiEditTemplate: string;
  defaultValues: string;
  describe: string;
  uiNewRecord: string;
  quickActions: string;
  layouts: string;
  sobject: string;
}

export interface DescribeSObjectResult {
  result: SObject;
}

export enum SObjectCategory {
  ALL = 'ALL',
  STANDARD = 'STANDARD',
  CUSTOM = 'CUSTOM'
}

type SubRequest = { method: string; url: string };
type BatchRequest = { batchRequests: SubRequest[] };

type SubResponse = { statusCode: number; result: SObject };

type BatchResponse = { hasErrors: boolean; results: SubResponse[] };

export class SObjectDescribe {
  private accessToken: string;
  private instanceUrl: string;
  // TODO should get the proper version from ??
  private readonly servicesPath: string = 'services/data';
  private readonly targetVersion = '40.0';
  private readonly versionPrefix = 'v' + this.targetVersion;
  private readonly sobjectsPart: string = this.versionPrefix + '/sobjects';
  private readonly batchPart: string = this.versionPrefix + '/composite/batch';

  // get the token and url by calling the org - short term, should be able to get it from the sfdx project
  private async setupConnection(projectPath: string, username?: string) {
    if (!this.accessToken) {
      let orgInfo: any;
      const builder = new SfdxCommandBuilder().withArg('force:org:display');
      if (username) {
        builder.args.push('--targetusername', username);
      }
      const command = builder.withJson().build();
      const execution = new CliCommandExecutor(command, {
        cwd: projectPath
      }).execute();
      const cmdOutput = new CommandOutput();
      const result = await cmdOutput.getCmdResult(execution);
      orgInfo = JSON.parse(result).result;
      this.accessToken = orgInfo.accessToken;
      this.instanceUrl = orgInfo.instanceUrl;
    }
  }
  public async describeSObject(
    projectPath: string,
    type: string,
    username?: string
  ): Promise<SObject> {
    await this.setupConnection(projectPath);

    const urlElements = [
      this.instanceUrl,
      this.servicesPath,
      this.sobjectsPart,
      type,
      'describe'
    ];

    const requestUrl = urlElements.join('/');

    const options: XHROptions = {
      type: 'GET',
      url: requestUrl,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `OAuth ${this.accessToken}`
      }
    };

    try {
      const response: XHRResponse = await xhr(options);
      const sobject = JSON.parse(response.responseText) as SObject;
      return Promise.resolve(sobject);
    } catch (error) {
      const xhrResponse: XHRResponse = error;
      return Promise.reject(xhrResponse.responseText);
    }
  }

  public async describeGlobal(
    projectPath: string,
    type: SObjectCategory,
    username?: string
  ): Promise<string[]> {
    const builder = new SfdxCommandBuilder()
      .withArg('force:schema:sobject:list')
      .withFlag('--sobjecttypecategory', type.toString());
    if (username) {
      builder.args.push('--targetusername', username);
    }
    const command = builder.withJson().build();
    const execution = new CliCommandExecutor(command, {
      cwd: projectPath
    }).execute();

    const cmdOutput = new CommandOutput();
    let result: string;
    try {
      result = await cmdOutput.getCmdResult(execution);
    } catch (e) {
      return Promise.reject(e);
    }
    try {
      const sobjects = JSON.parse(result).result as string[];
      return Promise.resolve(sobjects);
    } catch (e) {
      return Promise.reject(result);
    }
  }

  public async describeSObjectBatch(
    projectPath: string,
    types: string[],
    lastProcessed: number,
    username?: string
  ): Promise<SObject[]> {
    const batchSize = 25;

    await this.setupConnection(projectPath);

    const batchRequest: BatchRequest = { batchRequests: [] };

    for (
      let i = lastProcessed + 1;
      i <= lastProcessed + batchSize && i < types.length;
      i++
    ) {
      const urlElements = [this.sobjectsPart, types[i], 'describe'];
      const requestUrl = urlElements.join('/');

      batchRequest.batchRequests.push({ method: 'GET', url: requestUrl });
    }
    const batchUrlElements = [
      this.instanceUrl,
      this.servicesPath,
      this.batchPart
    ];
    const batchRequestUrl = batchUrlElements.join('/');
    const options: XHROptions = {
      type: 'POST',
      url: batchRequestUrl,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `OAuth ${this.accessToken}`
      },
      data: JSON.stringify(batchRequest)
    };

    try {
      const response: XHRResponse = await xhr(options);
      const batchResponse = JSON.parse(response.responseText) as BatchResponse;
      const fetchedObjects: SObject[] = [];
      for (const sr of batchResponse.results) {
        fetchedObjects.push(sr.result);
      }
      return Promise.resolve(fetchedObjects);
    } catch (error) {
      const xhrResponse: XHRResponse = error;
      return Promise.reject(xhrResponse.responseText);
    }
  }
}
