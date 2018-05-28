/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { BaseCommand } from '@salesforce/salesforcedx-apex-replay-debugger/node_modules/@salesforce/salesforcedx-utils-vscode/out/src/requestService';

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

  public getQueryString(): string | undefined {
    return this.queryString;
  }

  public getRequest(): string | undefined {
    return this.requestString;
  }
}
