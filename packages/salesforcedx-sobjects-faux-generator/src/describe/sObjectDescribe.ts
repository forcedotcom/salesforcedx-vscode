/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { DescribeGlobalResult, DescribeGlobalSObjectResult } from 'jsforce';
import { CLIENT_ID } from '../constants';
import { BatchRequest, BatchResponse, SObject, SObjectCategory } from './types';
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
   * @param type SObjectCategory
   * @returns string[] containing the sobject names
   */
  public async describeGlobal(type: SObjectCategory): Promise<string[]> {
    const requestedDescriptions: string[] = [];
    const allDescriptions: DescribeGlobalResult = await this.connection.describeGlobal();

    allDescriptions.sobjects.forEach((sobject: DescribeGlobalSObjectResult) => {
      const isCustom = sobject.custom === true;
      if (
        type === SObjectCategory.ALL ||
        (type === SObjectCategory.CUSTOM && isCustom) ||
        (type === SObjectCategory.STANDARD && !isCustom)
      ) {
        requestedDescriptions.push(sobject.name);
      }
    });

    return requestedDescriptions;
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

  public async describeSObjectBatch(types: string[]): Promise<SObject[]> {
    try {
      const batchRequest = this.buildBatchRequestBody(types);
      const batchResponse = await this.runRequest(batchRequest);

      const fetchedObjects: SObject[] = [];
      batchResponse.results.forEach((sr, i) => {
        if (sr.result instanceof Array) {
          if (sr.result[0].errorCode && sr.result[0].message) {
            console.log(`Error: ${sr.result[0].message} - ${types[i]}`);
          }
        }
        fetchedObjects.push(sr.result);
      });
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
