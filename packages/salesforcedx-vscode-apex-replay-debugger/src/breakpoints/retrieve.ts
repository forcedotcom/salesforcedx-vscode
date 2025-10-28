/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { breakpointUtil } from '@salesforce/salesforcedx-apex-replay-debugger';
import { nls } from '../messages';
import { getActiveSalesforceApexExtension } from '../utils/extensionApis';
import { writeToDebuggerMessageWindow } from './debuggerMessageWindow';

export const retrieveLineBreakpointInfo = async (): Promise<boolean> => {
  const salesforceApexExtension = await getActiveSalesforceApexExtension();
  let expired = false;
  let i = 0;
  while (!salesforceApexExtension.languageClientManager.getStatus().isReady() && !expired) {
    if (salesforceApexExtension.languageClientManager.getStatus().failedToInitialize()) {
      throw Error(salesforceApexExtension.languageClientManager.getStatus().getStatusMessage());
    }

    await imposeSlightDelay(100);
    if (i >= 30) {
      expired = true;
    }
    i++;
  }
  if (expired) {
    writeToDebuggerMessageWindow(nls.localize('language_client_not_ready'), true, 'error');
    return false;
  }
  const lineBpInfo = await salesforceApexExtension.getLineBreakpointInfo();
  if (lineBpInfo?.length) {
    console.log(nls.localize('line_breakpoint_information_success'));
    breakpointUtil.createMappingsFromLineBreakpointInfo(lineBpInfo);
    return true;
  }
  writeToDebuggerMessageWindow(nls.localize('no_line_breakpoint_information_for_current_project'), true, 'error');
  return true;
};

const imposeSlightDelay = (ms = 0) => new Promise(r => setTimeout(r, ms));
