/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import {
  CliCommandExecution,
  CliCommandExecutor,
  Command,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { extractJsonObject } from '@salesforce/salesforcedx-utils-vscode/out/src/helpers';
import { CLIENT_ID } from '../constants';

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

export class ForceListSObjectSchemaExecutor {
  public build(type: string): Command {
    return new SfdxCommandBuilder()
      .withArg('force:schema:sobject:list')
      .withFlag('--sobjecttypecategory', type)
      .withJson()
      .build();
  }

  public execute(projectPath: string, type: string): CliCommandExecution {
    const execution = new CliCommandExecutor(this.build(type), {
      cwd: projectPath
    }).execute();
    return execution;
  }
}

export class SObjectDescribe {
  private connection: Connection;
  private readonly servicesPath: string = 'services/data';
  // the targetVersion should be consistent with the Cli even if only using REST calls
  private readonly targetVersion = '46.0';
  private readonly versionPrefix = 'v';
  private readonly sobjectsPart: string = 'sobjects';
  private readonly batchPart: string = 'composite/batch';

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public async describeGlobal(
    projectPath: string,
    type: SObjectCategory
  ): Promise<string[]> {
    const forceListSObjectSchemaExecutor = new ForceListSObjectSchemaExecutor();
    const execution = forceListSObjectSchemaExecutor.execute(projectPath, type);
    const cmdOutput = new CommandOutput();
    let result: string;
    try {
      result = await cmdOutput.getCmdResult(execution);
    } catch (e) {
      return Promise.reject(e);
    }
    try {
      const sobjects = extractJsonObject(result).result as string[];
      return Promise.resolve(sobjects);
    } catch (e) {
      return Promise.reject(result);
    }
  }

  public buildSObjectDescribeURL(sObjectName: string): string {
    const urlElements = [
      this.getVersion(),
      this.sobjectsPart,
      sObjectName,
      'describe'
    ];
    return urlElements.join('/');
  }

  public buildBatchRequestURL(): string {
    const batchUrlElements = [
      this.connection.instanceUrl,
      this.servicesPath,
      this.getVersion(),
      this.batchPart
    ];
    return batchUrlElements.join('/');
  }

  public buildBatchRequestBody(
    types: string[],
    nextToProcess: number
  ): BatchRequest {
    const batchSize = 25;
    const batchRequest: BatchRequest = { batchRequests: [] };

    for (
      let i = nextToProcess;
      i < nextToProcess + batchSize && i < types.length;
      i++
    ) {
      batchRequest.batchRequests.push({
        method: 'GET',
        url: this.buildSObjectDescribeURL(types[i])
      });
    }

    return batchRequest;
  }

  public async runRequest(batchRequest: BatchRequest): Promise<BatchResponse> {
    return (this.connection.request({
      method: 'POST',
      url: this.buildBatchRequestURL(),
      body: JSON.stringify(batchRequest),
      headers: {
        'User-Agent': 'salesforcedx-extension',
        'Sforce-Call-Options': `client=${CLIENT_ID}`
      }
    }) as unknown) as BatchResponse;
  }

  public async describeSObjectBatch(
    types: string[],
    nextToProcess: number
  ): Promise<SObject[]> {
    try {
      const batchRequest = this.buildBatchRequestBody(types, nextToProcess);
      const batchResponse = await this.runRequest(batchRequest);
      const fetchedObjects: SObject[] = [];
      let i = nextToProcess;
      for (const sr of batchResponse.results) {
        if (sr.result instanceof Array) {
          if (sr.result[0].errorCode && sr.result[0].message) {
            console.log(`Error: ${sr.result[0].message} - ${types[i]}`);
          }
        }
        i++;
        fetchedObjects.push(sr.result);
      }
      return Promise.resolve(fetchedObjects);
    } catch (error) {
      const errorMsg = error.hasOwnProperty('body')
        ? error.body
        : error.message;
      return Promise.reject(errorMsg);
    }
  }

  public getVersion(): string {
    return `${this.versionPrefix}${this.targetVersion}`;
  }
}
