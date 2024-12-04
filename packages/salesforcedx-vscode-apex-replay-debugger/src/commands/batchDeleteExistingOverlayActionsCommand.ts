/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { COMPOSITE_BATCH_URL } from '@salesforce/salesforcedx-apex-replay-debugger/out/src/constants';
import { BaseCommand, RestHttpMethodEnum } from '@salesforce/salesforcedx-utils';

export type BatchRequests = {
  batchRequests: BatchRequest[];
};

export type BatchRequest = {
  method: RestHttpMethodEnum;
  url: string;
};

export type BatchDeleteResponse = {
  hasErrors: boolean;
  results: BatchDeleteResult[];
};

export type BatchDeleteResult = {
  statusCode: number;
  result: SingleResult[] | null;
};

export type SingleResult = {
  errorCode: string;
  message: string;
};

export class BatchDeleteExistingOverlayActionCommand extends BaseCommand {
  private readonly requests: BatchRequests;
  public constructor(requests: BatchRequests) {
    super(undefined);
    this.requests = requests;
  }

  public getCommandUrl(): string {
    return COMPOSITE_BATCH_URL;
  }

  public getRequest(): string | undefined {
    return JSON.stringify(this.requests);
  }
}
