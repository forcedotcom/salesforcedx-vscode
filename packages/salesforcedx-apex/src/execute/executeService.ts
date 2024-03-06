/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core';
import { existsSync, readFileSync } from 'fs';
import {
  ExecuteAnonymousResponse,
  ApexExecuteOptions,
  SoapResponse,
  soapEnv,
  soapBody,
  soapHeader,
  action
} from './types';
import { nls } from '../i18n';
import { refreshAuth } from '../utils';
import { encodeBody } from './utils';
import * as readline from 'readline';
import { HttpRequest } from 'jsforce';
import { elapsedTime } from '../utils/elapsedTime';

export class ExecuteService {
  public readonly connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  @elapsedTime()
  public async executeAnonymous(
    options: ApexExecuteOptions
  ): Promise<ExecuteAnonymousResponse> {
    const data = await this.getApexCode(options);

    let count = 0;
    while (count < 2) {
      try {
        const request = this.buildExecRequest(data);
        const result = await this.connectionRequest(request);
        return this.jsonFormat(result);
      } catch (e) {
        if (
          e.name === 'ERROR_HTTP_500' &&
          e.message &&
          e.message.includes('INVALID_SESSION_ID')
        ) {
          await refreshAuth(this.connection);
          count += 1;
        } else {
          throw new Error(
            nls.localize('unexpectedExecuteCommandError', e.message)
          );
        }
      }
    }
  }

  @elapsedTime()
  public async getApexCode(options: ApexExecuteOptions): Promise<string> {
    if (options.apexCode) {
      return String(options.apexCode);
    } else if (options.apexFilePath) {
      return this.readApexFile(options.apexFilePath);
    } else if (options.userInput) {
      return await this.getUserInput();
    } else {
      throw new Error(nls.localize('optionExecAnonError'));
    }
  }

  @elapsedTime()
  public readApexFile(filepath: string): string {
    if (!existsSync(filepath)) {
      throw new Error(nls.localize('fileNotFoundError', filepath));
    }
    return readFileSync(filepath, 'utf8');
  }

  @elapsedTime()
  public async getUserInput(): Promise<string> {
    process.stdout.write(nls.localize('execAnonInputPrompt'));
    return new Promise<string>((resolve, reject) => {
      const readInterface = readline.createInterface(
        process.stdin,
        process.stdout
      );
      const timeout = setTimeout(() => {
        reject(new Error(nls.localize('execAnonInputTimeout')));
        readInterface.close();
      }, 60000);

      let apexCode = '';
      readInterface.on('line', (input: string) => {
        timeout.refresh();
        apexCode = apexCode + input + '\n';
      });
      readInterface.on('close', () => {
        resolve(apexCode);
        clearTimeout(timeout);
      });
      readInterface.on('error', (err: Error) => {
        reject(
          new Error(nls.localize('unexpectedExecAnonInputError', err.message))
        );
      });
    });
  }

  // Tooling API execute anonymous apex REST endpoint was not used because
  // it requires multiple api calls to turn on trace flag, execute anonymous apex, and get the generated debug log
  private buildExecRequest(data: string): HttpRequest {
    const body = encodeBody(this.connection.accessToken, data);
    const postEndpoint = `${this.connection.instanceUrl}/services/Soap/s/${
      this.connection.version
    }/${this.connection.accessToken.split('!')[0]}`;
    const requestHeaders = {
      'content-type': 'text/xml',
      soapaction: action
    };
    const request: HttpRequest = {
      method: 'POST',
      url: postEndpoint,
      body,
      headers: requestHeaders
    };

    return request;
  }

  @elapsedTime()
  public jsonFormat(soapResponse: SoapResponse): ExecuteAnonymousResponse {
    const execAnonResponse =
      soapResponse[soapEnv][soapBody].executeAnonymousResponse.result;

    const formattedResponse: ExecuteAnonymousResponse = {
      compiled: execAnonResponse.compiled === 'true',
      success: execAnonResponse.success === 'true',
      logs: soapResponse[soapEnv][soapHeader]?.DebuggingInfo.debugLog
    };

    if (!formattedResponse.success) {
      formattedResponse.diagnostic = [
        {
          lineNumber: execAnonResponse.line,
          columnNumber: execAnonResponse.column,
          compileProblem:
            typeof execAnonResponse.compileProblem === 'object'
              ? ''
              : execAnonResponse.compileProblem,
          exceptionMessage:
            typeof execAnonResponse.exceptionMessage === 'object'
              ? ''
              : execAnonResponse.exceptionMessage,
          exceptionStackTrace:
            typeof execAnonResponse.exceptionStackTrace === 'object'
              ? ''
              : execAnonResponse.exceptionStackTrace
        }
      ];
    }

    return formattedResponse;
  }

  @elapsedTime()
  public async connectionRequest(
    requestData: HttpRequest
  ): Promise<SoapResponse> {
    return (await this.connection.request(requestData)) as SoapResponse;
  }
}
