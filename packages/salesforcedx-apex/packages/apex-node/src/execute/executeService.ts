/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core';
import { JsonCollection } from '@salesforce/ts-types';
import { existsSync, readFileSync } from 'fs';
import {
  SoapResponse,
  soapEnv,
  soapBody,
  soapHeader,
  RequestData,
  action
} from '../types/execute';
import { ExecuteAnonymousResponse, ApexExecuteOptions } from '../types';
import { nls } from '../i18n';
import { encodeBody } from './utils';
import * as readline from 'readline';

export class ExecuteService {
  public readonly connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

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
          await this.refreshAuth(this.connection);
          count += 1;
        } else {
          throw new Error(
            nls.localize('unexpected_execute_command_error', e.message)
          );
        }
      }
    }
  }

  public async getApexCode(options: ApexExecuteOptions): Promise<string> {
    if (options.apexCode) {
      return String(options.apexCode);
    } else if (options.apexFilePath) {
      return this.readApexFile(options.apexFilePath);
    } else if (options.userInput) {
      return await this.getUserInput();
    } else {
      throw new Error(nls.localize('option_exec_anon_error'));
    }
  }

  public readApexFile(filepath: string): string {
    if (!existsSync(filepath)) {
      throw new Error(nls.localize('file_not_found_error', filepath));
    }
    return readFileSync(filepath, 'utf8');
  }

  public async getUserInput(): Promise<string> {
    process.stdout.write(nls.localize('exec_anon_input_prompt'));
    return new Promise<string>((resolve, reject) => {
      const readInterface = readline.createInterface(
        process.stdin,
        process.stdout
      );
      const timeout = setTimeout(() => {
        reject(new Error(nls.localize('exec_anon_input_timeout')));
        readInterface.close();
      }, 10000);

      let apexCode = '';
      readInterface.on('line', (input: string) => {
        timeout.refresh();
        apexCode = apexCode + input + '\n';
      });
      readInterface.on('close', () => {
        resolve(apexCode);
      });
      readInterface.on('error', (err: Error) => {
        reject(
          new Error(
            nls.localize('unexpected_exec_anon_input_error', err.message)
          )
        );
      });
    });
  }

  // Tooling API execute anonymous apex REST endpoint was not used because
  // it requires multiple api calls to turn on trace flag, execute anonymous apex, and get the generated debug log
  private buildExecRequest(data: string): RequestData {
    const body = encodeBody(this.connection.accessToken, data);
    const postEndpoint = `${this.connection.instanceUrl}/services/Soap/s/${
      this.connection.version
    }/${this.connection.accessToken.split('!')[0]}`;
    const requestHeaders = {
      'content-type': 'text/xml',
      soapaction: action
    };
    const request = {
      method: 'POST',
      url: postEndpoint,
      body,
      headers: requestHeaders
    };

    return request;
  }

  public jsonFormat(soapResponse: SoapResponse): ExecuteAnonymousResponse {
    const execAnonResponse =
      soapResponse[soapEnv][soapBody].executeAnonymousResponse.result;

    const formattedResponse = {
      result: {
        compiled: execAnonResponse.compiled === 'true' ? true : false,
        compileProblem: execAnonResponse.compileProblem,
        success: execAnonResponse.success === 'true' ? true : false,
        line: execAnonResponse.line,
        column: execAnonResponse.column,
        exceptionMessage: execAnonResponse.exceptionMessage,
        exceptionStackTrace: execAnonResponse.exceptionStackTrace,
        logs: soapResponse[soapEnv][soapHeader].DebuggingInfo.debugLog
      }
    };

    return formattedResponse;
  }

  // TODO: make these general utils accessible to other classes
  public async connectionRequest(
    requestData: RequestData
  ): Promise<SoapResponse> {
    return (await this.connection.request(requestData)) as SoapResponse;
  }

  public async refreshAuth(connection: Connection): Promise<JsonCollection> {
    const requestInfo = { url: connection.baseUrl(), method: 'GET' };
    return await connection.request(requestInfo);
  }
}
