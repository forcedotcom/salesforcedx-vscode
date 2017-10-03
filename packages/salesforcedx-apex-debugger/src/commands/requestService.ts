/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { configure, xhr, XHROptions, XHRResponse } from 'request-light';
import { DEFAULT_REQUEST_TIMEOUT } from '../constants';
import { BaseCommand } from './baseCommand';

export class RequestService {
  private static instance: RequestService;
  private _instanceUrl: string;
  private _accessToken: string;
  private _proxyUrl: string;
  private _proxyStrictSSL: boolean;
  private _proxyAuthorization: string;

  public static getInstance() {
    if (!RequestService.instance) {
      RequestService.instance = new RequestService();
    }
    return RequestService.instance;
  }

  public static getEnvVars(): any {
    const envVars = Object.assign({}, process.env);
    const proxyUrl = RequestService.getInstance().proxyUrl;
    if (proxyUrl) {
      envVars['HTTP_PROXY'] = proxyUrl;
      envVars['HTTPS_PROXY'] = proxyUrl;
    }
    return envVars;
  }

  public get instanceUrl(): string {
    return this._instanceUrl;
  }

  public set instanceUrl(instanceUrl: string) {
    this._instanceUrl = instanceUrl;
  }

  public get accessToken(): string {
    return this._accessToken;
  }

  public set accessToken(accessToken: string) {
    this._accessToken = accessToken;
  }

  public get proxyUrl(): string {
    return this._proxyUrl;
  }

  public set proxyUrl(proxyUrl: string) {
    this._proxyUrl = proxyUrl;
  }

  public get proxyStrictSSL(): boolean {
    return this._proxyStrictSSL;
  }

  public set proxyStrictSSL(proxyStrictSSL: boolean) {
    this._proxyStrictSSL = proxyStrictSSL;
  }

  public get proxyAuthorization(): string {
    return this._proxyAuthorization;
  }

  public set proxyAuthorization(proxyAuthorization: string) {
    this._proxyAuthorization = proxyAuthorization;
  }

  public async execute(command: BaseCommand): Promise<string> {
    configure(this._proxyUrl, this._proxyStrictSSL);
    const urlElements = [this.instanceUrl, command.getCommandUrl()];
    const requestUrl =
      command.getQueryString() == null
        ? urlElements.join('/')
        : urlElements.join('/').concat('?', command.getQueryString()!);
    const options: XHROptions = {
      type: 'POST',
      url: requestUrl,
      timeout: DEFAULT_REQUEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `OAuth ${this.accessToken}`
      },
      data: command.getRequest()
        ? JSON.stringify(command.getRequest())
        : undefined
    };

    if (this.proxyAuthorization) {
      options.headers['Proxy-Authorization'] = this.proxyAuthorization;
    }

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
