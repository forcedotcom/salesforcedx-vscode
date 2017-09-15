/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { xhr, XHROptions, XHRResponse } from 'request-light';
import { DebuggerRequest } from './protocol';

export abstract class BaseCommand {
  private readonly queryString: string | undefined;
  private readonly commandName: string;
  private readonly instanceUrl: string;
  private readonly accessToken: string;
  private readonly debuggedRequestId: string;
  private readonly debuggerApiPath = 'services/debug/v41.0';
  private readonly request: DebuggerRequest | undefined;

  public constructor(
    commandName: string,
    instanceUrl: string,
    accessToken: string,
    debuggedRequestId: string,
    queryString?: string,
    request?: DebuggerRequest
  ) {
    this.commandName = commandName;
    this.instanceUrl = instanceUrl;
    this.accessToken = accessToken;
    this.debuggedRequestId = debuggedRequestId;
    this.queryString = queryString;
    this.request = request;
  }

  public async execute(): Promise<string> {
    const urlElements = [
      this.instanceUrl,
      this.debuggerApiPath,
      this.commandName,
      this.debuggedRequestId
    ];
    const debuggerApiUrl =
      this.queryString == null
        ? urlElements.join('/')
        : urlElements.join('/').concat('?', this.queryString);
    const options: XHROptions = {
      type: 'POST',
      url: debuggerApiUrl,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `OAuth ${this.accessToken}`
      },
      data: this.request ? JSON.stringify(this.request) : undefined
    };

    try {
      const response = await this.sendRequest(options);
      return Promise.resolve(response.responseText);
    } catch (error) {
      const xhrResponse: XHRResponse = error;
      return Promise.reject(xhrResponse.responseText);
    }
  }

  public async sendRequest(options: XHROptions): Promise<XHRResponse> {
    return xhr(options);
  }
}
