/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { DescribeGlobalResult } from 'jsforce';
import { CLIENT_ID } from '../constants';
import {
  BatchRequest,
  BatchResponse,
  SObject,
  SObjectCategory,
  SObjectRefreshSource
} from '../types';
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
  public async describeGlobal(
    category: SObjectCategory,
    source: SObjectRefreshSource
  ): Promise<string[]> {
    let requestedDescriptions: string[] = [];
    const allDescriptions: DescribeGlobalResult = await this.connection.describeGlobal();

    requestedDescriptions = allDescriptions.sobjects.reduce(
      (acc: string[], sobject) => {
        const isCustomObject =
          sobject.custom === true && category === SObjectCategory.CUSTOM;
        const isStandardObject =
          sobject.custom === false && category === SObjectCategory.STANDARD;

        if (
          category === SObjectCategory.ALL &&
          source === SObjectRefreshSource.Manual
        ) {
          acc.push(sobject.name);
        } else if (
          category === SObjectCategory.ALL &&
          (source === SObjectRefreshSource.StartupMin ||
            source === SObjectRefreshSource.Startup) &&
          this.isRequiredSObject(sobject.name)
        ) {
          acc.push(sobject.name);
        } else if (
          (isCustomObject || isStandardObject) &&
          source === SObjectRefreshSource.Manual &&
          this.isRequiredSObject(sobject.name)
        ) {
          acc.push(sobject.name);
        }

        return acc;
      },
      []
    );
    return requestedDescriptions;
  }

  private isRequiredSObject(sobject: string): boolean {
    // Ignore all sobjects that end with Share or History or Feed or Event
    return !/Share$|History$|Feed$|.+Event$/.test(sobject);
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
