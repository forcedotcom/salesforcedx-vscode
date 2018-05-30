/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { BaseCommand } from '@salesforce/salesforcedx-apex-replay-debugger/node_modules/@salesforce/salesforcedx-utils-vscode/out/src/requestService';
import { QUERY_URL } from '@salesforce/salesforcedx-apex-replay-debugger/out/src/constants';

export interface QueryOverlayActionIdsSuccessResult {
  size: number;
  totalSize: number;
  done: boolean;
  queryLocator: any | null;
  entityTypeName: string;
  records: ApexExecutionOverlayActionRecord[];
}
export interface ApexExecutionOverlayActionRecord {
  attributes: ApexExecutionOverlayActionRecordAttribute;
  Id: string;
}

export interface ApexExecutionOverlayActionRecordAttribute {
  type: string;
  url: string;
}

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
