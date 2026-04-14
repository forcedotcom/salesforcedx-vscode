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

export const soqlBuilderToggle = Effect.fn('soql_builder_toggle')(function* (doc: URI) {
  const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
  const isInBuilderView =
    activeTab?.input instanceof vscode.TabInputCustom &&
    activeTab.input.viewType === BUILDER_VIEW_TYPE;
  const viewType = isInBuilderView ? EDITOR_VIEW_TYPE : BUILDER_VIEW_TYPE;
  yield* Effect.promise(() => vscode.commands.executeCommand(OPEN_WITH_COMMAND, doc, viewType));
});
