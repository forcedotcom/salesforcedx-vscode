/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { breakpointUtil } from '@salesforce/salesforcedx-apex-replay-debugger';
import * as Effect from 'effect/Effect';
import type { ApexVSCodeApi } from 'salesforcedx-vscode-apex';
import * as vscode from 'vscode';
import { writeToDebuggerOutputWindow } from './channels';
import { waitForLanguageClientReady } from './languageClientReady';
import { nls } from './messages';

const apexExtension = vscode.extensions.getExtension<ApexVSCodeApi>('salesforce.salesforcedx-vscode-apex');
if (!apexExtension) {
  throw new Error('Salesforce Apex Extension not initialized');
}
export const salesforceApexExtension = apexExtension;

export const retrieveLineBreakpointInfo = Effect.fn('ApexReplayDebugger.retrieveLineBreakpointInfo')(function* () {
  if (!salesforceApexExtension.isActive) {
    yield* Effect.promise(() => salesforceApexExtension.activate());
  }
  const isReady = yield* waitForLanguageClientReady(() =>
    salesforceApexExtension.exports.languageClientManager.getStatus()
  );
  if (!isReady) {
    const errorMessage = nls.localize('language_client_not_ready');
    yield* Effect.sync(() => writeToDebuggerOutputWindow(errorMessage, 'error'));
    return false;
  }
  const lineBpInfo = yield* Effect.promise(() => salesforceApexExtension.exports.getLineBreakpointInfo());
  if (lineBpInfo?.length) {
    yield* Effect.log(nls.localize('line_breakpoint_information_success'));
    yield* Effect.sync(() => breakpointUtil.createMappingsFromLineBreakpointInfo(lineBpInfo));
  } else {
    const errorMessage = nls.localize('no_line_breakpoint_information_for_current_project');
    yield* Effect.sync(() => writeToDebuggerOutputWindow(errorMessage, 'error'));
  }
  return true;
});
