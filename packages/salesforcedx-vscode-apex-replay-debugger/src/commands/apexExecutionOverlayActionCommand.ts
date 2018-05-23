/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { BaseCommand } from '@salesforce/salesforcedx-utils-vscode/out/src/requestService';

export interface ApexExecutionOverlayFailureResult {
  message: string;
  errorCode: string;
  fields: string[];
}
export interface ApexExecutionOverlaySuccessResult {
  id: string;
  success: boolean;
  errors: string[];
  warnings: string[];
}

export class ApexExecutionOverlayActionCommand extends BaseCommand {
  private readonly apiPath = 'services/data/v43.0/tooling/sobjects';
  private readonly commandName = 'ApexExecutionOverlayAction';
  // The request string is basically the json string of the argumnets, if there are any
  private readonly requestString: string | undefined;
  private readonly actionObjectId: string | undefined;

  public constructor(
    requestString?: string,
    actionObjectId?: string,
    queryString?: string
  ) {
    super(queryString);
    this.requestString = requestString;
    this.actionObjectId = actionObjectId;
  }

  public getCommandUrl(): string {
    if (this.actionObjectId) {
      const urlElements = [this.apiPath, this.commandName, this.actionObjectId];
      return urlElements.join('/');
    } else {
      const urlElements = [this.apiPath, this.commandName];
      return urlElements.join('/');
    }
  }

  // For this particular message the query string should be undefined
  public getQueryString(): string | undefined {
    return this.queryString;
  }

  // The requestBody is going to contain the JSON string of all arguments
  public getRequest(): string | undefined {
    return this.requestString;
  }
}
