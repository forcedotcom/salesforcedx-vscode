/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { breakpointUtil } from '@salesforce/salesforcedx-apex-replay-debugger';
import type { ApexVSCodeApi } from 'salesforcedx-vscode-apex';
import * as vscode from 'vscode';
import { VSCodeWindowTypeEnum, writeToDebuggerOutputWindow } from './channels';
import { nls } from './messages';

const apexExtension = vscode.extensions.getExtension<ApexVSCodeApi>('salesforce.salesforcedx-vscode-apex');
if (!apexExtension) {
  throw new Error('Salesforce Apex Extension not initialized');
}
export const salesforceApexExtension = apexExtension;

export const retrieveLineBreakpointInfo = async (): Promise<boolean> => {
  if (!salesforceApexExtension.isActive) {
    await salesforceApexExtension.activate();
  }

  let expired = false;
  let i = 0;
  while (!salesforceApexExtension.exports.languageClientManager.getStatus().isReady() && !expired) {
    if (salesforceApexExtension.exports.languageClientManager.getStatus().failedToInitialize()) {
      throw Error(salesforceApexExtension.exports.languageClientManager.getStatus().getStatusMessage());
    }

    await imposeSlightDelay(100);
    if (i >= 30) {
      expired = true;
    }
    i++;
  }
  if (expired) {
    const errorMessage = nls.localize('language_client_not_ready');
    writeToDebuggerOutputWindow(errorMessage, true, VSCodeWindowTypeEnum.Error);
    return false;
  }

  const lineBpInfo = await salesforceApexExtension.exports.getLineBreakpointInfo();
  if (lineBpInfo?.length) {
    console.log(nls.localize('line_breakpoint_information_success'));
    breakpointUtil.createMappingsFromLineBreakpointInfo(lineBpInfo);
  } else {
    const errorMessage = nls.localize('no_line_breakpoint_information_for_current_project');
    writeToDebuggerOutputWindow(errorMessage, true, VSCodeWindowTypeEnum.Error);
  }
  return true;
};

const imposeSlightDelay = (ms = 0) => new Promise(r => setTimeout(r, ms));
