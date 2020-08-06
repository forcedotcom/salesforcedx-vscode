/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CommonOptions } from '../common';

export type ApexExecuteOptions = CommonOptions & {
  targetUsername?: string;
  apexFilePath?: string;
  apexCode?: string | Buffer;
  userInput?: boolean;
};

export const soapEnv = 'soapenv:Envelope';
export const soapBody = 'soapenv:Body';
export const soapHeader = 'soapenv:Header';
export const action = 'executeAnonymous';

export const soapTemplate = `<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema"
xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"
xmlns:cmd="http://soap.sforce.com/2006/08/apex"
xmlns:apex="http://soap.sforce.com/2006/08/apex">
    <env:Header>
        <cmd:SessionHeader>
            <cmd:sessionId>%s</cmd:sessionId>
        </cmd:SessionHeader>
        %s
    </env:Header>
    <env:Body>
        <%s xmlns="http://soap.sforce.com/2006/08/apex">
            %s
        </%s>
    </env:Body>
</env:Envelope>`;

export const xmlCharMap: { [index: string]: string } = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&apos;'
};

export interface SoapResponse {
  [soapEnv]?: {
    [soapHeader]: { DebuggingInfo: DebuggingInfo };
    [soapBody]: {
      executeAnonymousResponse: { result: ExecAnonApiResponse };
    };
  };
}

export interface DebuggingInfo {
  debugLog: string;
}

export interface RequestData {
  method: string;
  url: string;
  body: string;
  headers: {};
}

export type ExecuteAnonymousResponse = {
  compiled: boolean;
  success: boolean;
  logs?: string;
  diagnostic?: ApexDiagnostic[];
};

export type ExecAnonApiResponse = {
  column: number;
  compiled: string;
  compileProblem: string | object;
  exceptionMessage: string | object;
  exceptionStackTrace: string | object;
  line: number;
  success: string;
};

export type ApexDiagnostic = {
  lineNumber: number;
  columnNumber: number;
  exceptionMessage: string;
  compileProblem: string;
  exceptionStackTrace: string;
};
