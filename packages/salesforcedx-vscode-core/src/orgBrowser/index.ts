/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export { TypeUtils, MetadataObject } from './metadataType';
export { MetadataOutlineProvider } from './metadataOutlineProvider';
export { BrowserNode, NodeType } from './nodeTypes';
export { ComponentUtils } from './metadataCmp';
import { OrgBrowser } from './browser';
export const orgBrowser = OrgBrowser.getInstance();
