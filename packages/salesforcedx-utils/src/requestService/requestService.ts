/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { configure, xhr, XHROptions, XHRResponse } from 'request-light';
import {
  CLIENT_ID,
  DEFAULT_CONNECTION_TIMEOUT_MS,
  ENV_HTTPS_PROXY,
  ENV_HTTP_PROXY,
  ENV_SF_TARGET_ORG,
  ENV_SF_ORG_INSTANCE_URL
} from '../constants';
import { BaseCommand } from './baseCommand';

// Right now have POST and DELETE (out of Query, GET, POST, PATCH, DELETE),
// add any new ones needed as they are encountered. Note: when adding those
// it'll be the responsibility of whomever added them to verify or change
// anything in the arguments for the call to deal with them.
export enum RestHttpMethodEnum {
  Delete = 'DELETE',
  Get = 'GET',
  Post = 'POST'
}

export class RequestService {
  private _instanceUrl!: string;
  private _accessToken!: string;
  private _proxyUrl!: string;
  private _proxyStrictSSL = false;
  private _proxyAuthorization!: string;
  private _connectionTimeoutMs: number = DEFAULT_CONNECTION_TIMEOUT_MS;

  public getEnvVars(): NodeJS.ProcessEnv {
    const envVars = { ...process.env };
    const proxyUrl = this.proxyUrl;
    if (proxyUrl) {
      envVars[ENV_HTTP_PROXY] = proxyUrl;
      envVars[ENV_HTTPS_PROXY] = proxyUrl;
    }
    const instanceUrl = this.instanceUrl;
    if (instanceUrl) {
      envVars[ENV_SF_ORG_INSTANCE_URL] = instanceUrl;
    }
    const sid = this.accessToken;
    if (sid) {
      envVars[ENV_SF_TARGET_ORG] = sid;
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

  public get connectionTimeoutMs(): number {
    return this._connectionTimeoutMs || DEFAULT_CONNECTION_TIMEOUT_MS;
  }

  public set connectionTimeoutMs(connectionTimeoutMs: number) {
    this._connectionTimeoutMs = connectionTimeoutMs;
  }

  // Execute defaults to POST
  public async execute(
    command: BaseCommand,
    restHttpMethodEnum: RestHttpMethodEnum = RestHttpMethodEnum.Post
  ): Promise<string> {
    if (this.proxyUrl) {
      configure(this._proxyUrl, this._proxyStrictSSL);
    }
    const urlElements = [this.instanceUrl, command.getCommandUrl()];
    const queryString = command.getQueryString();
    const requestUrl = !queryString ? urlElements.join('/') : urlElements.join('/').concat('?', queryString);
    const requestBody = command.getRequest();
    const options: XHROptions = {
      type: restHttpMethodEnum,
      url: requestUrl,
      timeout: this.connectionTimeoutMs,
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
        Accept: 'application/json',
        Authorization: `OAuth ${this.accessToken}`,
        'Content-Length': requestBody ? String(Buffer.byteLength(requestBody, 'utf-8')) : '0',
        'Sforce-Call-Options': `client=${CLIENT_ID}`
      },
      data: requestBody
    };

    if (this.proxyAuthorization && options.headers) {
      options.headers['Proxy-Authorization'] = this.proxyAuthorization;
    }

    try {
      const response = await this.sendRequest(options);
      return response.responseText;
    } catch (error) {
      const xhrResponse: XHRResponse = error;
      throw xhrResponse.responseText;
    }
  }

  public async sendRequest(options: XHROptions): Promise<XHRResponse> {
    return xhr(options);
  }
}
