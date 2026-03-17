/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { BUILDER_VIEW_TYPE, EDITOR_VIEW_TYPE, OPEN_WITH_COMMAND } from '../constants';
import { nls } from '../messages';
import { isDefaultOrgSet } from '../services/org';

export const soqlBuilderToggle = Effect.fn('soql_builder_toggle')(function* (doc: URI) {
  const hasOrg = yield* Effect.promise(() => isDefaultOrgSet());
  if (!hasOrg) {
    yield* Effect.sync(() => {
      void vscode.window.showWarningMessage(nls.localize('info_no_default_org'));
    });
    return;
  }
  const viewType = vscode.window.activeTextEditor ? BUILDER_VIEW_TYPE : EDITOR_VIEW_TYPE;
  yield* Effect.promise(() => vscode.commands.executeCommand(OPEN_WITH_COMMAND, doc, viewType));
});
