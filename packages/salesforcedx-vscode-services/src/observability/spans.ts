/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Global } from '@salesforce/core';
import { NodeSdkLayer } from './spansNode';
import { WebSdkLayer } from './spansWeb';

export const SdkLayer = process.env.ESBUILD_PLATFORM === 'web' || Global.isWeb ? WebSdkLayer : NodeSdkLayer;
