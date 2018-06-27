/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export enum ActionScriptEnum {
  None = 'None',
  Apex = 'Apex',
  SOQL = 'SOQL'
}

export interface OrgInfoError {
  message: string;
  status: number;
  name: string;
  warnings: string[];
}

export {
  ApexExecutionOverlayResultCommand,
  ApexExecutionOverlayResultCommandFailure,
  ApexExecutionOverlayResultCommandSuccess
} from './apexExecutionOverlayResultCommand';
