/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { DescribeGlobalResult, DescribeSObjectResult, Field } from 'jsforce';
import { SObjectShortDescription } from '.';
import { CLIENT_ID } from '../constants';
import { BatchRequest, BatchResponse, SObject } from '../types';
import { SObjectField } from '../types/describe';
export const MAX_BATCH_REQUEST_SIZE = 25;

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

  /**
   * Method that returns a list of SObjects based on running a describe global request
   * More info at https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_describeGlobal.htm
   * @returns Promise<SObjectShortDescription[]> containing the sobject names and 'custom' classification
   */
  public async describeGlobal(): Promise<SObjectShortDescription[]> {
    const allDescriptions: DescribeGlobalResult = await this.connection.describeGlobal();
    const requestedDescriptions = allDescriptions.sobjects.map(sobject => {
      return { name: sobject.name, custom: sobject.custom };
    });
    return requestedDescriptions;
  }

  public getVersion(): string {
    return `${this.versionPrefix}${this.targetVersion}`;
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

  public async describeSObjectBatchRequest(
    types: string[]
  ): Promise<SObject[]> {
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
            console.log(`Error: ${sr.result[0].message} - ${types[i]}`);
          }
        } else fetchedObjects.push(toMinimalSObject(sr.result));
      });

      return Promise.resolve(fetchedObjects);
    } catch (error) {
      const errorMsg = error.hasOwnProperty('body')
        ? error.body
        : error.message;
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

    const results = await Promise.all(requests);
    const fetchedSObjects = ([] as SObject[]).concat(...results);
    return fetchedSObjects;
  }
}

/**
 * Convert jsforce's complete sobject metadata to our internal (smaller) SObject representation
 *
 * @param describeSObject full metadata of an sobject, as returned by the jsforce's sobject/describe api
 * @returns SObject containing a subset of DescribeSObjectResult information
 */
export function toMinimalSObject(
  describeSObject: DescribeSObjectResult
): SObject {
  return {
    fields: describeSObject.fields
      ? describeSObject.fields.map(toMinimalSObjectField)
      : [],
    ...pick(
      describeSObject,
      'label',
      'childRelationships',
      'custom',
      'name',
      'queryable'
    )
  };
}

function toMinimalSObjectField(describeField: Field): SObjectField {
  return pick(
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
}

function pick<T, K extends keyof T>(obj: T, ...keys: K[]): Pick<T, K> {
  const ret: any = {};
  keys.forEach(key => {
    ret[key] = obj[key];
  });
  return ret;
}
