/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { BaseCommand } from '@salesforce/salesforcedx-utils';
import { DebuggerRequest } from './protocol';

const DEBUGGER_API_PATH = 'services/debug/v41.0';

export class BaseDebuggerCommand extends BaseCommand {
  private readonly commandName: string;
  private readonly debuggedRequestId: string;
  private readonly request: DebuggerRequest | undefined;

  public constructor(commandName: string, debuggedRequestId: string, queryString?: string, request?: DebuggerRequest) {
    super(queryString);
    this.commandName = commandName;
    this.debuggedRequestId = debuggedRequestId;
    this.request = request;
  }

  public getCommandUrl(): string {
    return [DEBUGGER_API_PATH, this.commandName, this.debuggedRequestId].join('/');
  }

  public getQueryString(): string | undefined {
    return this.queryString;
  }

  public getRequest(): string | undefined {
    if (this.request) {
      return JSON.stringify(this.request);
    } else {
      return undefined;
    }
  }
}
