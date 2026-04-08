/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ChannelService } from '../commands/channelService';
import * as vscode from 'vscode';

/** Must match the org extension id in its `package.json` (`publisher`.`name`). */
const SALESFORCE_VSCODE_ORG_EXTENSION_ID = 'salesforce.salesforcedx-vscode-org';

/** Public API returned by Salesforce Org Management `activate()` (same shape as Core extension `channelService`). */
export type SalesforceVSCodeOrgApi = {
  channelService: Pick<ChannelService, 'appendLine' | 'showChannelOutput'>;
};

export const getSalesforceVSCodeOrgExtension = async (): Promise<vscode.Extension<SalesforceVSCodeOrgApi>> => {
  const salesforceVSCodeOrgExtension = vscode.extensions.getExtension<SalesforceVSCodeOrgApi>(
    SALESFORCE_VSCODE_ORG_EXTENSION_ID
  );
  if (!salesforceVSCodeOrgExtension) {
    throw new Error('Could not fetch a SalesforceVSCodeOrgApi instance');
  }
  if (!salesforceVSCodeOrgExtension.isActive) {
    await salesforceVSCodeOrgExtension.activate();
  }
  return salesforceVSCodeOrgExtension;
};
