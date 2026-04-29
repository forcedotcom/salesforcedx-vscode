/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CancelResponse, ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';

export type DirFileNameSelection = {
  fileName: string;
  outputdir: string;
  template?: 'ApexUnitTest' | 'BasicUnitTest';
  extension?: 'JavaScript' | 'TypeScript';
};

export type LocalComponent = DirFileNameSelection & {
  type: string;
  suffix?: string;
};

export type OneOrMany = LocalComponent | LocalComponent[];
export type ContinueOrCancel = ContinueResponse<OneOrMany> | CancelResponse;
export type ComponentName = {
  name?: string;
};

export const isContinue = (continueOrCancel: ContinueOrCancel): continueOrCancel is ContinueResponse<OneOrMany> =>
  Reflect.get(continueOrCancel, 'type') === 'CONTINUE';

export const isComponentName = (component: ComponentName | LocalComponent): component is ComponentName =>
  Reflect.has(component, 'name');
