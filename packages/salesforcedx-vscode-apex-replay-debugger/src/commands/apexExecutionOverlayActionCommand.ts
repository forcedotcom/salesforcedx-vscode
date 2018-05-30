/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { BaseCommand } from '@salesforce/salesforcedx-apex-replay-debugger/node_modules/@salesforce/salesforcedx-utils-vscode/out/src/requestService';
import { SOBJECTS_URL } from '@salesforce/salesforcedx-apex-replay-debugger/out/src/constants';

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
      const urlElements = [SOBJECTS_URL, this.commandName, this.actionObjectId];
      return urlElements.join('/');
    } else {
      const urlElements = [SOBJECTS_URL, this.commandName];
      return urlElements.join('/');
    }
  }

  public getRequest(): string | undefined {
    return this.requestString;
  }
}
