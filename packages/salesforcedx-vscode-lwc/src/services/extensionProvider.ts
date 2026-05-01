/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { buildAllServicesLayer as buildAllServicesLayerCore } from '@salesforce/effect-ext-utils';
import type { ExtensionContext } from 'vscode';

export const buildAllServicesLayer = (context: ExtensionContext) =>
  buildAllServicesLayerCore(context, 'Lightning Web Components');

export let AllServicesLayer: ReturnType<typeof buildAllServicesLayer>;

export const setAllServicesLayer = (layer: ReturnType<typeof buildAllServicesLayer>) => {
  AllServicesLayer = layer;
};
