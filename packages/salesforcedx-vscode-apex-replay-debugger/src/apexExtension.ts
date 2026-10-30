/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CallableSchema, getExtensionExports } from '@salesforce/effect-ext-utils';
import { breakpointUtil } from '@salesforce/salesforcedx-apex-replay-debugger';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import type { ApexVSCodeApi } from 'salesforcedx-vscode-apex';
import { writeToDebuggerOutputWindow } from './channels';
import { waitForLanguageClientReady } from './languageClientReady';
import { nls } from './messages';

// Preserve the manager instance because getStatus reads its state through `this`.
const languageClientManagerSchema: Schema.Schema<Pick<ApexVSCodeApi['languageClientManager'], 'getStatus'>> =
  Schema.declare(
    Schema.is(Schema.Struct({ getStatus: CallableSchema<ApexVSCodeApi['languageClientManager']['getStatus']>() }), {
      exact: false
    })
  );

export const retrieveLineBreakpointInfo = Effect.fn('ApexReplayDebugger.retrieveLineBreakpointInfo')(function* () {
  const apexApi = yield* getExtensionExports({
    extId: 'salesforce.salesforcedx-vscode-apex',
    schema: Schema.Struct({
      getLineBreakpointInfo: CallableSchema<ApexVSCodeApi['getLineBreakpointInfo']>(),
      languageClientManager: languageClientManagerSchema
    })
  });
  const isReady = yield* waitForLanguageClientReady(() => apexApi.languageClientManager.getStatus());
  if (!isReady) {
    const errorMessage = nls.localize('language_client_not_ready');
    yield* Effect.sync(() => writeToDebuggerOutputWindow(errorMessage, 'error'));
    return false;
  }
  const lineBpInfo = yield* Effect.promise(() => apexApi.getLineBreakpointInfo());
  if (lineBpInfo?.length) {
    yield* Effect.log(nls.localize('line_breakpoint_information_success'));
    yield* Effect.sync(() => breakpointUtil.createMappingsFromLineBreakpointInfo(lineBpInfo));
  } else {
    const errorMessage = nls.localize('no_line_breakpoint_information_for_current_project');
    yield* Effect.sync(() => writeToDebuggerOutputWindow(errorMessage, 'error'));
  }
  return true;
});
