/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CancelResponse,
  ContinueResponse,
  DirFileNameSelection,
  LocalComponent
} from '@salesforce/salesforcedx-utils-vscode';
import { LWC } from './componentUtils';

export type OneOrMany = LocalComponent | LocalComponent[];
export type ContinueOrCancel = ContinueResponse<OneOrMany> | CancelResponse;
export type ComponentName = {
  name?: string;
};

export const isContinue = (contineOrCancel: ContinueOrCancel): contineOrCancel is ContinueResponse<OneOrMany> => {
  return Reflect.get(contineOrCancel, 'type') === 'CONTINUE';
};

export const isComponentName = (component: ComponentName | LocalComponent): component is ComponentName => {
  return Reflect.has(component, 'name');
};

export const isDirFileNameSelection = (
  component: DirFileNameSelection | LocalComponent
): component is DirFileNameSelection => {
  return Reflect.has(component, 'fileName') && Reflect.has(component, 'outputdir');
};

export const isLwcComponentPath = (componentDir: string): boolean => {
  return componentDir.endsWith(LWC);
};
