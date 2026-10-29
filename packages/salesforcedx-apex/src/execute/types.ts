/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { type ApexDiagnostic } from '../utils';

export type ApexExecuteOptions = {
  apexCode: string;
};

export type ExecuteAnonymousResponse = {
  compiled: boolean;
  success: boolean;
  logs?: string;
  diagnostic?: ApexDiagnostic[];
};
