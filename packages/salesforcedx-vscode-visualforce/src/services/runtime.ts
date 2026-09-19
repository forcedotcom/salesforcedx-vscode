/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { makeVscodeExtensionRuntime } from '@salesforce/vscode-extension-runtime';
import { AllServicesLayer } from './extensionProvider';

const createVisualforceRuntime = () => makeVscodeExtensionRuntime(AllServicesLayer);
let _visualforceRuntime: ReturnType<typeof createVisualforceRuntime> | undefined; // lazy singleton
export const getRuntime = () => {
  _visualforceRuntime ??= createVisualforceRuntime();
  return _visualforceRuntime;
};
