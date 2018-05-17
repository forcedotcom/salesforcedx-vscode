/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { BaseCommand } from '@salesforce/salesforcedx-utils-vscode/out/src/requestService';
import { RestHttpMethodEnum } from '@salesforce/salesforcedx-utils-vscode/out/src/requestService';

// The batch requests is pretty straightforward, it's an array of single requests
export interface BatchRequests {
  batchRequests: BatchRequest[];
}

export interface BatchRequest {
  method: RestHttpMethodEnum;
  url: string;
}

export interface BatchDeleteResponse {
  hasErrors: boolean;
  results: BatchDeleteResult[];
}

export interface BatchDeleteResult {
  statusCode: number;
  result: SingleResult[] | null;
}

export interface SingleResult {
  errorCode: string;
  message: string;
}

export class BatchDeleteExistingOverlayActionCommand extends BaseCommand {
  private readonly url = 'services/data/v43.0/tooling/composite/batch';
  private readonly requests: BatchRequests;
  public constructor(requests: BatchRequests) {
    super(undefined);
    this.requests = requests;
  }

  public getCommandUrl(): string {
    return this.url;
  }
  // For this particular message the query string should be undefined
  public getQueryString(): string | undefined {
    return this.queryString;
  }

  // The requestBody is going to contain the JSON string of all arguments
  public getRequest(): string | undefined {
    return JSON.stringify(this.requests);
  }
}
