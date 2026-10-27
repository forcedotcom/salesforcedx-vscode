/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { type ApexDiagnostic, type CommonOptions } from '../utils';

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

export type ExecuteAnonymousResponse = {
  compiled: boolean;
  success: boolean;
  logs?: string;
  diagnostic?: ApexDiagnostic[];
};
