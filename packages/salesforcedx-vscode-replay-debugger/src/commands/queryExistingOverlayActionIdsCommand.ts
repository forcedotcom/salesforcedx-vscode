/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { BaseCommand } from '@salesforce/salesforcedx-utils-vscode/out/src/requestService';

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
  private readonly apiPath = 'services/data/v43.0/tooling/query';
  private readonly userId: string;
  public constructor(userId: string) {
    super('q=SELECT Id FROM ApexExecutionOverlayAction WHERE ScopeId=');
    this.userId = userId;
  }

  public getCommandUrl(): string {
    return this.apiPath;
  }

  // For this particular message the query string will be the combination of the queryString passed
  // into the super with the single quoted userId appeneded at the end
  public getQueryString(): string | undefined {
    return this.queryString + "'" + this.userId + "'";
  }

  // For this particular message the requestString should be undefined
  public getRequest(): string | undefined {
    return undefined;
  }
}
