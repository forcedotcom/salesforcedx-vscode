/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { QUERY_URL } from '@salesforce/salesforcedx-apex-replay-debugger/out/src/constants';
import { BaseCommand } from '@salesforce/salesforcedx-utils';

export type QueryOverlayActionIdsSuccessResult = {
  size: number;
  totalSize: number;
  done: boolean;
  queryLocator: any;
  entityTypeName: string;
  records: ApexExecutionOverlayActionRecord[];
};

type ApexExecutionOverlayActionRecord = {
  attributes: ApexExecutionOverlayActionRecordAttribute;
  Id: string;
};

type ApexExecutionOverlayActionRecordAttribute = {
  type: string;
  url: string;
};

export class QueryExistingOverlayActionIdsCommand extends BaseCommand {
  private readonly userId: string;
  public constructor(userId: string) {
    super('q=SELECT Id FROM ApexExecutionOverlayAction WHERE ScopeId=');
    this.userId = userId;
  }

  public getCommandUrl(): string {
    return QUERY_URL;
  }

  public getQueryString(): string | undefined {
    return `${this.queryString}'${this.userId}'`;
  }

  public getRequest(): string | undefined {
    return undefined;
  }
}
