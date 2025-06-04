/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { CLIENT_ID } from '../constants';
import { BatchRequest, BatchResponse, SObject } from '../types';
import { DescribeSObjectResult, Field, SObjectField } from '../types/describe';
import { SObjectShortDescription, SObjectsStandardAndCustom } from './types';

const MAX_BATCH_REQUEST_SIZE = 25;

export class SObjectDescribe {
  private connection: Connection;
  private readonly servicesPath: string = 'services/data';
  private readonly versionPrefix = 'v';
  private readonly sobjectsPart: string = 'sobjects';
  private readonly batchPart: string = 'composite/batch';

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Method that returns a list of SObjects based on running a describe global request
   * More info at https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_describeGlobal.htm
   * @returns Promise<SObjectShortDescription[]> containing the sobject names and 'custom' classification
   */
  public async describeGlobal(): Promise<SObjectShortDescription[]> {
    const allDescriptions = await this.connection.describeGlobal();
    const requestedDescriptions = allDescriptions.sobjects.map(sobject => ({
      name: sobject.name,
      custom: sobject.custom
    }));
    return requestedDescriptions;
  }

  public getVersion(): string {
    return `${this.versionPrefix}${this.connection.getApiVersion()}`;
  }

  public buildSObjectDescribeURL(sObjectName: string): string {
    const urlElements = [this.getVersion(), this.sobjectsPart, sObjectName, 'describe'];
    return urlElements.join('/');
  }

  public buildBatchRequestURL(): string {
    const batchUrlElements = [this.connection.instanceUrl, this.servicesPath, this.getVersion(), this.batchPart];
    return batchUrlElements.join('/');
  }

  public buildBatchRequestBody(types: string[]): BatchRequest {
    const batchRequest: BatchRequest = { batchRequests: [] };

    for (const objType of types) {
      batchRequest.batchRequests.push({
        method: 'GET',
        url: this.buildSObjectDescribeURL(objType)
      });
    }

    return batchRequest;
  }

  public async runRequest(batchRequest: BatchRequest): Promise<BatchResponse> {
    return this.connection.request<BatchResponse>({
      method: 'POST',
      url: this.buildBatchRequestURL(),
      body: JSON.stringify(batchRequest),
      headers: {
        'User-Agent': 'salesforcedx-extension',
        'Sforce-Call-Options': `client=${CLIENT_ID}`
      }
    });
  }

  public async describeSObjectBatchRequest(types: string[]): Promise<SObject[]> {
    try {
      const batchRequest = this.buildBatchRequestBody(types);
      const batchResponse = await this.runRequest(batchRequest);

      const fetchedObjects: SObject[] = [];
      if (batchResponse && batchResponse.results === undefined) {
        return Promise.resolve(fetchedObjects);
      }

      batchResponse.results.forEach((sr, i) => {
        if (sr.result instanceof Array) {
          if (sr.result[0].errorCode && sr.result[0].message) {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            console.log(`Error: ${sr.result[0].message} - ${types[i]}`);
          }
        } else fetchedObjects.push(toMinimalSObject(sr.result));
      });

      return Promise.resolve(fetchedObjects);
    } catch (error) {
      const errorMsg = Reflect.has(error, 'body') ? error.body : error.message;
      return Promise.reject(errorMsg);
    }
  }

  public async fetchObjects(types: string[]): Promise<SObject[]> {
    const batchSize = MAX_BATCH_REQUEST_SIZE;
    const requests = [];
    for (let i = 0; i < types.length; i += batchSize) {
      const batchTypes = types.slice(i, i + batchSize);
      requests.push(this.describeSObjectBatchRequest(batchTypes));
    }
    return (await Promise.all(requests)).flat();
  }
}

export const describeSObjects = async (
  conn: Connection,
  sobjectNames: SObjectShortDescription[]
): Promise<SObjectsStandardAndCustom> => {
  const describe = new SObjectDescribe(conn);
  const objects = await describe.fetchObjects(sobjectNames.map(s => s.name));
  // TODO node22: object.groupBy
  return {
    standard: objects.filter(o => !o.custom),
    custom: objects.filter(o => o.custom)
  };
};

/**
 * Convert jsforce's complete sobject metadata to our internal (smaller) SObject representation
 *
 * @param describeSObject full metadata of an sobject, as returned by the jsforce's sobject/describe api
 * @returns SObject containing a subset of DescribeSObjectResult information
 */
export const toMinimalSObject = (describeSObject: DescribeSObjectResult): SObject => ({
  fields: describeSObject.fields ? describeSObject.fields.map(toMinimalSObjectField) : [],
  ...pick(describeSObject, 'label', 'childRelationships', 'custom', 'name', 'queryable')
});

const toMinimalSObjectField = (describeField: Field): SObjectField =>
  pick(
    describeField,
    'aggregatable',
    'custom',
    'defaultValue',
    'extraTypeInfo',
    'filterable',
    'groupable',
    'inlineHelpText',
    'label',
    'name',
    'nillable',
    'picklistValues',
    'referenceTo',
    'relationshipName',
    'sortable',
    'type'
  );

const pick = <T, K extends keyof T>(obj: T, ...keys: K[]): Pick<T, K> => {
  const ret: any = {};
  keys.forEach(key => {
    ret[key] = obj[key];
  });
  return ret;
};

/**
 * Method that returns a list of SObjects based on running a describe global request
 * More info at https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_describeGlobal.htm
 * @returns Promise<SObjectShortDescription[]> containing the sobject names and 'custom' classification
 */
export const describeGlobal = async (conn: Connection): Promise<SObjectShortDescription[]> => {
  const allDescriptions = await conn.describeGlobal();
  const requestedDescriptions = allDescriptions.sobjects.map(sobject => ({
    name: sobject.name,
    custom: sobject.custom
  }));
  return requestedDescriptions;
};
